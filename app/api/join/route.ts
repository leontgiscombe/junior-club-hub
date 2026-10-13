// Joining a club, on its own address (lib/access.ts), with an account (lib/auth.ts).
//   GET                          -> { private, status: "none" | "pending" | "approved" | "declined" }
//   POST { code }                -> checks the club code: { status: "ok", teams } for the rest of
//                                   the form (a hub open to all is joined the same way: anyone can
//                                   look around, but a parent joins to add their children)
//   POST { code, name, phone?, relation, team?, children?: [{ name, team }], note? }   (signed in)
//                                -> { status: "pending" }; the club's admins and coaches hear
//                                   there's someone to approve (lib/notify.ts)
// The teams are only shown once the code is right, and a parent types their
// own children's names: nobody who isn't approved sees the club's players.
import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE, RELATIONS, normaliseCode, readMember, type Relation } from "@/lib/access";
import { currentUser, setUserName, setUserPhone } from "@/lib/auth";
import { clientIp } from "@/lib/clientIp";
import { rawKv } from "@/lib/kv";
import { getAccess } from "@/lib/members";
import { notifyJoinRequest } from "@/lib/notify";
import { BAD_PHONE, NEED_PHONE, cleanPhone } from "@/lib/phone";
import { cleanChildren, currentPerson, pickTeam, requestToJoinAsPerson } from "@/lib/people";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { tenantExists } from "@/lib/tenants";

export const dynamic = "force-dynamic";

const MAX_TRIES = 30; // an hour, per IP address (a club house's wifi is shared)

async function club(): Promise<string | null> {
  const tenant = await getTenant();
  return tenant && (await tenantExists(tenant)) ? tenant : null;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(req: NextRequest) {
  const tenant = await club();
  if (!tenant) return NextResponse.json({ error: "No club here" }, { status: 404 });
  const [access, me, device] = await Promise.all([
    getAccess(tenant),
    currentPerson(tenant),
    readMember(tenant, req.cookies.get(MEMBER_COOKIE)?.value ?? ""),
  ]);
  const status = me?.person?.status ?? (device?.status === "approved" ? "approved" : "none");
  return NextResponse.json({ private: access.private, status });
}

export async function POST(req: NextRequest) {
  const tenant = await club();
  if (!tenant) return NextResponse.json({ error: "No club here" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? normaliseCode(body.code) : "";

  // a limited number of tries an hour from one place, so codes can't be guessed
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ipKey = `platform:join-ip:${clientIp(req.headers)}`;
  const tries = await kv.incr(ipKey);
  if (tries === 1) await kv.expire(ipKey, 3600);
  if (tries > MAX_TRIES) return NextResponse.json({ error: "Too many tries — try again later" }, { status: 429 });

  const access = await getAccess(tenant);
  if (code !== access.code) {
    return NextResponse.json({ error: "That isn't this club's code — check it with your coach" }, { status: 400 });
  }
  const teams = (await getTeams()).map((t) => ({ slug: t.slug, name: t.name }));

  // just the code: the rest of the form
  if (body?.name === undefined) return NextResponse.json({ status: "ok", teams });

  const name = text(body.name, 60);
  const relation = (Object.keys(RELATIONS) as Relation[]).find((r) => r === body.relation);
  // a parent's teams are their children's; anyone else picks their own
  const children = relation === "parent" ? cleanChildren(body.children, teams) : [];
  const team = relation === "parent" ? undefined : pickTeam(body.team, teams);
  const note = text(body.note, 120);
  if (!name) return NextResponse.json({ error: "Enter your name, so the coaches know who you are" }, { status: 400 });
  if (!relation) return NextResponse.json({ error: "Choose who you are" }, { status: 400 });
  const phone = cleanPhone(body.phone);
  if (phone === null) return NextResponse.json({ error: BAD_PHONE }, { status: 400 });
  if (!phone) return NextResponse.json({ error: NEED_PHONE }, { status: 400 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!user.name) await setUserName(user.id, name);
  if (phone !== user.phone) await setUserPhone(user.id, phone);

  const person = await requestToJoinAsPerson(tenant, user, { name, phone, relation, team, children, note });
  const res = NextResponse.json({ status: person.status });
  if (person.status === "approved") return res;

  // let the club's admins and coaches know (lib/notify.ts) — no children's names
  const teamRefs = [team, ...children.map((c) => c.team)].filter((t): t is { slug: string; name: string } => !!t);
  const teamNames = [...new Set(teamRefs.map((t) => t.name))];
  await notifyJoinRequest(tenant, {
    userId: user.id,
    name,
    who: [RELATIONS[relation].toLowerCase(), ...teamNames].join(", "),
    teams: [...new Set(teamRefs.map((t) => t.slug))],
    clubName: (await getClub()).name,
  });
  return res;
}
