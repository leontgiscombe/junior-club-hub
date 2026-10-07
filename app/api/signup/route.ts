// Signing a club up on the platform: its name, web address, the organiser's
// email and the coach password. Creates the club, gives it its name, and
// answers with the club's own address.
//   GET  ?address=riverside -> { ok } or { error } (is the address free?)
//   POST { name, address, email, password, website } -> { url }
import { NextRequest, NextResponse } from "next/server";
import { rawKv } from "@/lib/kv";
import { saveClubChanges } from "@/lib/settings";
import { sendEmail, simpleEmail } from "@/lib/email";
import { PLATFORM_NAME, getTenant, tenantUrl } from "@/lib/tenant";
import { addressProblem, createTenant } from "@/lib/tenants";

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
  if (!name) return NextResponse.json({ error: "Enter the club's name" }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "The coach password needs at least 8 characters" }, { status: 400 });
  }
  const problem = await addressProblem(address);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // a few sign-ups an hour from one place, at most
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const tries = await kv.incr(`platform:signup-ip:${ip}`);
  if (tries === 1) await kv.expire(`platform:signup-ip:${ip}`, 3600);
  if (tries > 5) return NextResponse.json({ error: "Too many sign-ups — try again later" }, { status: 429 });

  if (!(await createTenant({ id: address, name, email, password }))) {
    return NextResponse.json({ error: "That address was just taken — try another" }, { status: 409 });
  }
  await saveClubChanges({ name, fullName: name }, address);
  await sendEmail({
    to: email,
    subject: `${name} is on ${PLATFORM_NAME}`,
    ...simpleEmail({
      heading: `Welcome to ${PLATFORM_NAME}!`,
      paragraphs: [
        `${name}'s hub is ready at ${tenantUrl(address)}.`,
        "Sign in to Coach Admin with your coach password to add your badge, colours and teams, then share the address with your parents.",
        "If you ever forget the coach password, use “Forgot the password?” on the sign-in page and a reset link comes to this email.",
      ],
      button: { label: "Open Coach Admin", url: tenantUrl(address, "/admin/settings") },
      footer: `You're getting this because this email was used to sign ${name} up on ${PLATFORM_NAME}.`,
    }),
  });
  return NextResponse.json({ url: tenantUrl(address, "/admin/settings") });
}
