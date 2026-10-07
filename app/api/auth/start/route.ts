// Start signing in: emails a 6-digit code and a sign-in link (lib/auth.ts).
//   POST { email, next? } -> { ok } (the same whether or not there's an account)
import { NextRequest, NextResponse } from "next/server";
import { EMAIL, cleanEmail, requestOrigin, startLogin } from "@/lib/auth";
import { clientIp } from "@/lib/clientIp";
import { sendEmail, simpleEmail } from "@/lib/email";
import { rawKv } from "@/lib/kv";
import { safeNext } from "@/lib/safeNext";
import { getClub } from "@/lib/settings";
import { PLATFORM_NAME, getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function tooMany(key: string, max: number): Promise<boolean> {
  const kv = await rawKv();
  if (!kv) return true;
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, 3600);
  return n > max;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = cleanEmail(body?.email);
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if ((await tooMany(`platform:signin-ip:${clientIp(req.headers)}`, 20)) || (await tooMany(`platform:signin-email:${email}`, 5))) {
    return NextResponse.json({ error: "Too many sign-in emails — try again in an hour" }, { status: 429 });
  }
  const next = safeNext(body?.next);
  const { loginId, token, code } = await startLogin(email, next);
  const link = `${await requestOrigin()}/signin/verify?id=${loginId}&t=${token}`;
  const where = (await getTenant()) ? (await getClub()).name : PLATFORM_NAME;
  await sendEmail({
    to: email,
    subject: `${code} is your ${where} sign-in code`,
    ...simpleEmail({
      heading: `Your sign-in code: ${code.slice(0, 3)} ${code.slice(3)}`,
      paragraphs: [
        `Type this code where you asked to sign in to ${where}, or tap the button. Both work for the next 15 minutes, once.`,
        "If you didn't ask to sign in, ignore this email.",
      ],
      button: { label: "Sign In", url: link },
      footer: PLATFORM_NAME,
    }),
  });
  return NextResponse.json({ ok: true });
}
