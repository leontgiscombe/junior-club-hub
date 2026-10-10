// Vercel Cron (see vercel.json): on the 1st and 15th of each month, nudges
// every manager, in every club, who turned on reminders in the subs tracker to check who has
// paid. It sends a generic message only and never reads the encrypted team data.
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getAllTeamsFor, getClubFor } from "@/lib/settings";
import { allTenantIds } from "@/lib/tenants";
import { financeConfigured, financeKeys, redis } from "@/lib/financeStorage";
import { setUpVapid } from "@/lib/vapid";

export const dynamic = "force-dynamic";

// Reminders are sent with the hub's VAPID key pair (lib/vapid.ts); the page
// gets the public one from /api/club.

export async function GET(req: NextRequest) {
  // With CRON_SECRET set, only Vercel Cron (which sends it) may trigger this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const subject = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://example.com";
  if (!(await setUpVapid(subject))) {
    return NextResponse.json({ error: "No keys for phone alerts (the database isn't set up)" }, { status: 503 });
  }

  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const body =
    req.nextUrl.searchParams.get("when") === "mid"
      ? `Halfway through ${monthName} — any subs still outstanding? A quick chase helps.`
      : `It's ${monthName} — check who's paid and chase anyone outstanding.`;
  let sent = 0;
  let removed = 0;
  let total = 0;

  // every club on the platform, one at a time
  for (const tenant of await allTenantIds()) {
    const [CLUB, TEAMS] = await Promise.all([getClubFor(tenant), getAllTeamsFor(tenant)]);
    if (!CLUB.features.financialAdmin) continue;
    const SUBS = financeKeys(tenant).pushSubs;
    const members = ((await redis(["SMEMBERS", SUBS])) as string[] | null) ?? [];
    total += members.length;
    await Promise.all(
      members.map(async (m) => {
        let rec: { endpoint: string; keys: { p256dh: string; auth: string }; team?: string };
        try {
          rec = JSON.parse(m);
        } catch {
          return;
        }
        const team = TEAMS.find((t) => t.slug === rec.team);
        const payload = JSON.stringify({
          title: `${team ? `${CLUB.name} ${team.squadName ?? team.name}` : CLUB.name} — subs reminder`,
          body,
          url: "/finance",
        });
        try {
          await webpush.sendNotification({ endpoint: rec.endpoint, keys: rec.keys }, payload);
          sent++;
        } catch (err) {
          // Forget subscriptions the browser has given up on, and old ones made
          // with a previous key (403), which can't be sent to any more.
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 403 || code === 404 || code === 410) {
            await redis(["SREM", SUBS, m]);
            removed++;
          }
        }
      }),
    );
  }

  return NextResponse.json({ ok: true, sent, removed, total });
}
