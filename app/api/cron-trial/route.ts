// The daily trial reminders (scripts/run-reminders.mjs, with CRON_SECRET): a
// club whose free trial has 7 days, then 1 day, left gets an email to its
// address, once each, pointing at its Plans page (lib/billing.ts).
import { NextRequest, NextResponse } from "next/server";
import { billingState } from "@/lib/billing";
import { sendEmail, simpleEmail } from "@/lib/email";
import { PLATFORM_NAME, tenantUrl } from "@/lib/tenant";
import { listTenantsForAdmin, setTenantBilling } from "@/lib/tenants";

export const dynamic = "force-dynamic";

const NOTICES = [7, 1];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let sent = 0;
  for (const club of await listTenantsForAdmin()) {
    const state = billingState(club.billing);
    if (state.kind !== "trial") continue;
    const due = NOTICES.find((d) => state.daysLeft <= d && !(club.billing?.reminded ?? []).includes(d));
    if (!due) continue;
    const days = `${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}`;
    await sendEmail({
      to: club.email,
      subject: `${club.name}: ${days} left of your free trial`,
      ...simpleEmail({
        heading: `${days} left of ${club.name}'s free trial`,
        paragraphs: [
          `${club.name}'s free trial of ${PLATFORM_NAME} ends on ${new Date(state.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
          "Choose a plan, from £4.99 a month by how many teams you have, and everything carries on as it is. If you don't, the hub pauses — nothing is deleted, and it opens again as soon as you subscribe.",
        ],
        button: { label: "See the Plans", url: tenantUrl(club.id, "/plans") },
        footer: PLATFORM_NAME,
      }),
    }).catch(() => false);
    await setTenantBilling(club.id, { reminded: [...(club.billing?.reminded ?? []), ...NOTICES.filter((d) => d >= due)] });
    sent++;
  }
  return NextResponse.json({ sent });
}
