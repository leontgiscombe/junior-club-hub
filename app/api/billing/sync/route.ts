// After a club admin buys or restores a plan in the App Store app
// (app/plans/AppPlans.tsx): read the club's subscription back from RevenueCat
// now, rather than waiting on its webhook (lib/revenuecat.ts).
//   POST -> { ok: true }
import { NextResponse } from "next/server";
import { currentPerson } from "@/lib/people";
import { syncClubBilling } from "@/lib/revenuecat";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  if (!tenant || !me?.person || me.person.status !== "approved" || !me.person.roles.includes("admin")) {
    return NextResponse.json({ error: "Only the club's admins can do this" }, { status: 403 });
  }
  try {
    if (!(await syncClubBilling(tenant))) return NextResponse.json({ error: "Subscriptions aren't set up yet" }, { status: 503 });
  } catch (err) {
    console.error("Billing sync", err);
    return NextResponse.json({ error: "Couldn't check the subscription — try again" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
