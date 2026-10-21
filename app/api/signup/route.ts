// Signing a club up on the platform: its name, web address, the organiser's
// email and its teams (each one's age group, formation, training days and FA
// Full-Time code), and which of them the organiser coaches. Creates the club
// with them, and answers with the club's own address. There is no shared
// coach password: the organiser signs in with their email (the sign-up form
// sends them a code straight away) and is the club's admin, with their team;
// everyone else joins with the club code and their own account.
//   GET  ?address=riverside -> { ok } or { error } (is the address free?)
//   POST { name, address, email, teams: [{ name, format?, formation?, training?, faSnippet? }],
//          myTeam?: index into teams, website, agreed } -> { url }
//   (or, from before teams: { …, team, format? } for a single team)
import { NextRequest, NextResponse } from "next/server";
import { rawKv } from "@/lib/kv";
import { cleanTeams, isGameFormat, slugFor, type Team } from "@/lib/clubSettings";
import { showCode } from "@/lib/access";
import { getAccess, setPasswordOff, setPrivate } from "@/lib/members";
import { saveClubChanges, saveTeams } from "@/lib/settings";
import { sendEmail, simpleEmail } from "@/lib/email";
import { operator } from "@/lib/legal";
import { PLATFORM_NAME, getTenant, platformUrl, tenantUrl } from "@/lib/tenant";
import { addressProblem, createTenant } from "@/lib/tenants";
import { clientIp } from "@/lib/clientIp";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function onPlatform() {
  return (await getTenant()) === null;
}

export async function GET(req: NextRequest) {
  if (!(await onPlatform())) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const address = (req.nextUrl.searchParams.get("address") ?? "").trim().toLowerCase();
  const problem = await addressProblem(address);
  return NextResponse.json(problem ? { error: problem } : { ok: true });
}

export async function POST(req: NextRequest) {
  if (!(await onPlatform())) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // a box people never see; anything in it is a bot
  if (!body || body.website) return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const address = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
  // its teams, each given a slug from its name (cleanTeams checks the rest)
  const sent = Array.isArray(body.teams)
    ? body.teams
    : [{ name: (typeof body.team === "string" ? body.team.trim() : "") || "First Team", format: body.format }];
  const slugged: Team[] = [];
  // each sent team's slug, by its place in what was sent
  const slugAt: (string | undefined)[] = [];
  for (const raw of sent.slice(0, 30)) {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const teamName = typeof r.name === "string" ? r.name.trim().slice(0, 30) : "";
    // only what sign-up asks for: no archived teams, history or opponents from here
    const team = teamName
      ? ({ slug: slugFor(teamName, slugged), name: teamName, accent: "⚽", format: isGameFormat(r.format) ? r.format : undefined, formation: r.formation, training: r.training, faSnippet: r.faSnippet } as Team)
      : null;
    if (team) slugged.push(team);
    slugAt.push(team?.slug);
  }
  const teams = cleanTeams(slugged);
  // the organiser's own team: their account takes it when they first sign in
  const mine = typeof body.myTeam === "number" ? slugAt[body.myTeam] : undefined;
  if (!name) return NextResponse.json({ error: "Enter the club's name" }, { status: 400 });
  if (!teams) return NextResponse.json({ error: "Add at least one team" }, { status: 400 });
  if (body.agreed !== true) {
    return NextResponse.json({ error: "Please agree to the Terms of Use to sign up" }, { status: 400 });
  }
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const problem = await addressProblem(address);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // a few sign-ups an hour from one place, at most
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ip = clientIp(req.headers);
  const tries = await kv.incr(`platform:signup-ip:${ip}`);
  if (tries === 1) await kv.expire(`platform:signup-ip:${ip}`, 3600);
  if (tries > 5) return NextResponse.json({ error: "Too many sign-ups — try again later" }, { status: 429 });

  if (!(await createTenant({ id: address, name, email, ...(mine ? { ownerTeam: mine } : {}) }))) {
    return NextResponse.json({ error: "That address was just taken — try another" }, { status: 409 });
  }
  await saveClubChanges({ name, fullName: name }, address);
  // each team's age group and formation decide the Training Hub its players see
  await saveTeams(teams, address);
  // new hubs are private: parents join with the club code and a coach approves them
  await setPrivate(address, true);
  // coaches sign in with their own accounts, not a shared password
  await setPasswordOff(address, true);
  const { code } = await getAccess(address);
  const contact = operator().email;
  await sendEmail({
    to: email,
    replyTo: contact || undefined,
    subject: `${name} is on ${PLATFORM_NAME}`,
    ...simpleEmail({
      heading: `Welcome to ${PLATFORM_NAME}!`,
      paragraphs: [
        `${name}'s hub is ready at ${tenantUrl(address)}.`,
        "Open Coach Admin and sign in with this email address — you're the club's admin, no password needed. A short Set Up Your Club checklist there takes you through the rest: your crest and colours, your teams, inviting your coaches and getting parents to join. Each step ticks itself off as you go.",
        `Your club code is ${showCode(code)}. Parents, players and your other coaches type it at ${platformUrl("/").replace(/^https?:\/\//, "").replace(/\/$/, "")}, sign in with their email and ask to join. You approve them, and choose what each can do, in Coach Admin → Members.`,
        ...(contact ? [`Any questions, just reply to this email or write to ${contact}.`] : []),
      ],
      button: { label: "Open Coach Admin", url: tenantUrl(address, "/admin") },
      footer: `You're getting this because this email was used to sign ${name} up on ${PLATFORM_NAME}.`,
    }),
  });
  // Coach Admin, with Set Up Your Club at the top
  return NextResponse.json({ url: tenantUrl(address, "/admin") });
}
