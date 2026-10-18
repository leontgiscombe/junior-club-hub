// RevenueCat's webhook (lib/revenuecat.ts): every purchase, renewal,
// cancellation, refund or expiry, from the App Store app or the website. It
// carries only who changed; the club's plan is read back from RevenueCat, so
// events arriving late or twice do no harm. RevenueCat sends the
// Authorization header set in its dashboard, REVENUECAT_WEBHOOK_AUTH here.
//   POST { event: { app_user_id, original_app_user_id, aliases, transferred_from, transferred_to, … } }
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { revenueCatConfigured, syncClubBilling, tenantOf } from "@/lib/revenuecat";
import { getTenantRecord } from "@/lib/tenants";

export const runtime = "nodejs";

function authorised(header: string | null): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorised(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!revenueCatConfigured()) return NextResponse.json({ error: "RevenueCat isn't set up" }, { status: 503 });
  const event = ((await req.json().catch(() => null)) as { event?: Record<string, unknown> } | null)?.event ?? {};
  const ids = [event.app_user_id, event.original_app_user_id, event.aliases, event.transferred_from, event.transferred_to].flat();
  const tenants = [...new Set(ids.map(tenantOf).filter((t): t is string => !!t))];
  try {
    for (const tenant of tenants) {
      if (await getTenantRecord(tenant)) await syncClubBilling(tenant);
    }
  } catch (err) {
    // an error answer makes RevenueCat send the event again later
    console.error("RevenueCat webhook:", err);
    return NextResponse.json({ error: "Couldn't update the club" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, clubs: tenants.length });
}
