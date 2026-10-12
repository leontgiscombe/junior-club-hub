// Changing the signed-in person's email address (lib/auth.ts): it's how they
// sign in, so the new one is checked with a code first.
//   POST { email } -> { ok }: a 6-digit code is emailed to the new address
//   PUT  { code }  -> { email }: the account moves to the new address, at
//                     every club too; the old address is told it changed
import { NextRequest, NextResponse } from "next/server";
import { kvCall, peopleKey, readPerson } from "@/lib/access";
import { cleanEmail, currentUser, finishEmailChange, startEmailChange, userClubsKey } from "@/lib/auth";
import { sendEmail, simpleEmail } from "@/lib/email";
import { overLimit } from "@/lib/rateLimit";
import { PLATFORM_NAME } from "@/lib/tenant";
import { getTenantRecord, setTenantEmail } from "@/lib/tenants";

export const dynamic = "force-dynamic";

const notSignedIn = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return notSignedIn();
  if (await overLimit(`email-change:${user.id}`, 5, 3600)) {
    return NextResponse.json({ error: "Too many tries — try again in an hour" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = cleanEmail(body?.email);
  const started = await startEmailChange(user, email);
  if ("error" in started) return NextResponse.json({ error: started.error }, { status: 400 });
  const { code } = started;
  await sendEmail({
    to: email,
    subject: `${code} is your code to change your email`,
    ...simpleEmail({
      heading: `Your code: ${code.slice(0, 3)} ${code.slice(3)}`,
      paragraphs: [
        `Type this code in Your Account → Your Details to make ${email} the address you sign in with. It works for the next 15 minutes, once.`,
        "If you didn't ask for this, ignore this email — nothing changes.",
      ],
      footer: PLATFORM_NAME,
    }),
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return notSignedIn();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const done = await finishEmailChange(user, code);
  if ("error" in done) return NextResponse.json({ error: done.error }, { status: 400 });
  const { user: moved, from } = done;

  // the same address at each of their clubs (what the coaches see, and where alerts go); a club
  // that was set up with their old address — its own email, for password resets — moves with it
  for (const club of (await kvCall<string[]>(["SMEMBERS", userClubsKey(moved.id)])) ?? []) {
    const person = await readPerson(club, moved.id);
    if (person) await kvCall(["HSET", peopleKey(club), moved.id, JSON.stringify({ ...person, email: moved.email })]);
    const record = await getTenantRecord(club).catch(() => null);
    if (record && record.email.toLowerCase() === from) await setTenantEmail(club, moved.email);
  }

  // a heads-up at the old address, in case it wasn't them
  await sendEmail({
    to: from,
    subject: "Your email address was changed",
    ...simpleEmail({
      heading: "Your email address was changed",
      paragraphs: [
        `Your ${PLATFORM_NAME} account now signs in with ${moved.email} instead of this address.`,
        "If that was you, there's nothing to do. If it wasn't, reply to this email straight away.",
      ],
      footer: PLATFORM_NAME,
    }),
  }).catch(() => false);
  return NextResponse.json({ email: moved.email });
}
