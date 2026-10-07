// Joining a club, on its own address (lib/access.ts), with an account (lib/auth.ts).
//   GET                          -> { private, status: "none" | "pending" | "approved" | "declined" }
//   POST { code }                -> checks the club code: { status: "open" } if the hub is open to
//                                   all, otherwise { status: "ok", teams } for the rest of the form
//   POST { code, name, relation, team?, children?: [{ name, team }], note? }   (signed in)
//                                -> { status: "pending" }; the club's email hears there's someone
//                                   to approve
// The teams are only shown once the code is right, and a parent types their
// own children's names: nobody who isn't approved sees the club's players.
import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE, RELATIONS, normaliseCode, readMember, type Relation } from "@/lib/access";
import { currentUser, setUserName } from "@/lib/auth";
import { clientIp } from "@/lib/clientIp";
import { sendEmail, simpleEmail } from "@/lib/email";
import { rawKv } from "@/lib/kv";
import { getAccess } from "@/lib/members";
import { cleanChildren, currentPerson, pickTeam, requestToJoinAsPerson } from "@/lib/people";
import { getClub, getTeams } from "@/lib/settings";
import { DEFAULT_TENANT, PLATFORM_NAME, getTenant, tenantUrl } from "@/lib/tenant";
import { getTenantRecord, tenantExists } from "@/lib/tenants";

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
  if (!access.private) return NextResponse.json({ status: "open" });
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
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!user.name) await setUserName(user.id, name);

  const person = await requestToJoinAsPerson(tenant, user, { name, relation, team, children, note });
  const res = NextResponse.json({ status: person.status });
  if (person.status === "approved") return res;

  // let the club know — at most one email every half hour (it has no children's names in it)
  if (tenant !== DEFAULT_TENANT && (await kv.set(`platform:join-email:${tenant}`, 1, { nx: true, ex: 1800 }))) {
    const record = await getTenantRecord(tenant);
    const clubInfo = await getClub();
    if (record) {
      const teamNames = [...new Set([team?.name, ...children.map((c) => c.team?.name)].filter(Boolean))];
      const who = [RELATIONS[relation].toLowerCase(), ...teamNames].join(", ");
      await sendEmail({
        to: record.email,
        subject: `Someone wants to join ${clubInfo.name}`,
        ...simpleEmail({
          heading: "A new request to join",
          paragraphs: [
            `${name} (${who}) has asked to join ${clubInfo.name}'s hub.`,
            "Approve or decline them in Coach Admin → Members.",
          ],
          button: { label: "Open Members", url: tenantUrl(tenant, "/admin/members") },
          footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
        }),
      }).catch(() => false);
    }
  }
  return res;
}
