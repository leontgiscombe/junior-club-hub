// Vercel Cron (see vercel.json): on the 1st and 15th of each month, nudges
// every manager who turned on reminders in the subs tracker to check who has
// paid. It sends a generic message only and never reads the encrypted team data.
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { TEAMS } from "@/club.config";
import { getClub } from "@/lib/settings";
import { PUSH_SUBS_KEY, financeConfigured, redis } from "@/lib/financeStorage";

export const dynamic = "force-dynamic";

// Reminders need a VAPID key pair: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in
// the environment (the page gets the public one from /api/club).

export async function GET(req: NextRequest) {
  // With CRON_SECRET set, only Vercel Cron (which sends it) may trigger this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set" }, { status: 503 });
  }

  webpush.setVapidDetails(
    // Push services (Apple especially) want a real contact: the hub's address.
    process.env.VAPID_SUBJECT ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://example.com"),
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );

  const CLUB = await getClub();
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const body =
    req.nextUrl.searchParams.get("when") === "mid"
      ? `Halfway through ${monthName} — any subs still outstanding? A quick chase helps.`
      : `It's ${monthName} — check who's paid and chase anyone outstanding.`;
  const members = ((await redis(["SMEMBERS", PUSH_SUBS_KEY])) as string[] | null) ?? [];
  let sent = 0;
  let removed = 0;

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
        title: `${team ? `${CLUB.name} ${team.squadName}` : CLUB.name} — subs reminder`,
        body,
        url: "/finance",
      });
      try {
        await webpush.sendNotification({ endpoint: rec.endpoint, keys: rec.keys }, payload);
        sent++;
      } catch (err) {
        // Forget subscriptions the browser has given up on, and old ones made
        // with the previous app's key (403), which can't be sent to any more.
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 403 || code === 404 || code === 410) {
          await redis(["SREM", PUSH_SUBS_KEY, m]);
          removed++;
        }
      }
    }),
  );

  return NextResponse.json({ ok: true, sent, removed, total: members.length });
}
