// Signing a club up on the platform: its name, web address, the organiser's
// email, the coach password and its first team. Creates the club with its
// name and that one team (more are added in Settings), and answers with the
// club's own address.
//   GET  ?address=riverside -> { ok } or { error } (is the address free?)
//   POST { name, address, email, password, team, website } -> { url }
import { NextRequest, NextResponse } from "next/server";
import { rawKv } from "@/lib/kv";
import { slugFor } from "@/lib/clubSettings";
import { showCode } from "@/lib/access";
import { getAccess, setPrivate } from "@/lib/members";
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
  const password = typeof body.password === "string" ? body.password : "";
  const team = (typeof body.team === "string" ? body.team.trim().slice(0, 30) : "") || "First Team";
  if (!name) return NextResponse.json({ error: "Enter the club's name" }, { status: 400 });
  if (body.agreed !== true) {
    return NextResponse.json({ error: "Please agree to the Terms of Use to sign up" }, { status: 400 });
  }
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "The coach password needs at least 8 characters" }, { status: 400 });
  }
  const problem = await addressProblem(address);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // a few sign-ups an hour from one place, at most
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ip = clientIp(req.headers);
  const tries = await kv.incr(`platform:signup-ip:${ip}`);
  if (tries === 1) await kv.expire(`platform:signup-ip:${ip}`, 3600);
  if (tries > 5) return NextResponse.json({ error: "Too many sign-ups — try again later" }, { status: 429 });

  if (!(await createTenant({ id: address, name, email, password }))) {
    return NextResponse.json({ error: "That address was just taken — try another" }, { status: 409 });
  }
  await saveClubChanges({ name, fullName: name }, address);
  await saveTeams([{ slug: slugFor(team, []), name: team, accent: "⚽" }], address);
  // new hubs are private: parents join with the club code and a coach approves them
  await setPrivate(address, true);
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
        "Open Coach Admin and choose “Sign In With Your Email” — with this email address you're the club's admin, no password needed. Add your badge, colours and any more teams there.",
        `Your club code is ${showCode(code)}. Parents, players and your other coaches type it at ${platformUrl("/").replace(/^https?:\/\//, "").replace(/\/$/, "")}, sign in with their email and ask to join. You approve them, and choose what each can do, in Coach Admin → Members.`,
        "The coach password you chose still works too, for now.",
        ...(contact ? [`Any questions, just reply to this email or write to ${contact}.`] : []),
      ],
      button: { label: "Open Coach Admin", url: tenantUrl(address, "/admin") },
      footer: `You're getting this because this email was used to sign ${name} up on ${PLATFORM_NAME}.`,
    }),
  });
  return NextResponse.json({ url: tenantUrl(address, "/admin/settings") });
}
