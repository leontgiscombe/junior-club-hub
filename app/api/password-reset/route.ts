// Resetting a club's coach password by email.
//   POST { action: "request", email }          -> emails a reset link if it's the club's email
//   POST { action: "check", token }            -> { valid }
//   POST { action: "reset", token, password }  -> sets the new password
// The answer to "request" is the same whether or not the email matched, so
// it can't be used to find out a club's email.
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, simpleEmail } from "@/lib/email";
import { rawKv } from "@/lib/kv";
import { getClub } from "@/lib/settings";
import { DEFAULT_TENANT, PLATFORM_NAME, getTenant, tenantUrl } from "@/lib/tenant";
import { createResetToken, getTenantRecord, redeemResetToken, resetTokenTenant, setTenantPassword } from "@/lib/tenants";

export const dynamic = "force-dynamic";

const SENT = "If that's the club's email, a reset link is on its way. It works for an hour.";

export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Not here" }, { status: 404 });
  if (tenant === DEFAULT_TENANT) {
    return NextResponse.json(
      { error: "This hub's coach password is set by whoever runs it (ADMIN_KEY)." },
      { status: 400 },
    );
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === "request") {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const record = await getTenantRecord(tenant);
    if (!record || !email) return NextResponse.json({ message: SENT });
    // a few reset emails an hour per club, at most
    const kv = await rawKv();
    if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
    const tries = await kv.incr(`platform:reset-requests:${tenant}`);
    if (tries === 1) await kv.expire(`platform:reset-requests:${tenant}`, 3600);
    if (tries > 5) return NextResponse.json({ message: SENT });
    if (record.email.toLowerCase() === email) {
      const token = await createResetToken(tenant);
      const club = await getClub();
      const link = tenantUrl(tenant, `/reset-password?token=${encodeURIComponent(token)}`);
      await sendEmail({
        to: record.email,
        subject: `Reset the ${club.name} coach password`,
        ...simpleEmail({
          heading: "Reset your coach password",
          paragraphs: [
            `Someone asked to reset the coach password for ${club.name} on ${PLATFORM_NAME}.`,
            "Tap the button to choose a new one. The link works once, for the next hour.",
            "If it wasn't you, ignore this email and the password stays as it is.",
          ],
          button: { label: "Choose a New Password", url: link },
          footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
        }),
      });
    }
    return NextResponse.json({ message: SENT });
  }

  if (action === "check") {
    const token = typeof body?.token === "string" ? body.token : "";
    return NextResponse.json({ valid: (await resetTokenTenant(token)) === tenant });
  }

  if (action === "reset") {
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (password.length < 8) {
      return NextResponse.json({ error: "The new password needs at least 8 characters" }, { status: 400 });
    }
    if ((await resetTokenTenant(token)) !== tenant || (await redeemResetToken(token)) !== tenant) {
      return NextResponse.json({ error: "That link has expired or already been used — ask for a new one" }, { status: 400 });
    }
    await setTenantPassword(tenant, password);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
