// GET /api/cron-fixtures — the daily job's automatic fixture reminders
// (scripts/run-reminders.mjs, every morning, with CRON_SECRET).
//
// Fixtures work out their club from the address they're asked at, so this
// goes round the clubs by asking each one at its own address (?club=1); the
// default club at this one. A club's run sends each sent game's automatic
// reminder once it's due — the set number of days before its reply-by time,
// or before the game without one — to the families still to answer for an
// invited child and the coaches still to say if they can be there, once.
import { NextRequest, NextResponse } from "next/server";
import { listMatches, markAutoReminded } from "@/lib/matchStorage";
import { deadlinePassed } from "@/lib/fixtures";
import { tellFamilies } from "@/lib/fixtureAlerts";
import { ukToday } from "@/lib/fixtureFormat";
import { DEFAULT_TENANT, requireTenant, rootDomain, tenantUrl } from "@/lib/tenant";
import { allTenantIds } from "@/lib/tenants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ---- one club, at its own address ----
  if (req.nextUrl.searchParams.get("club") === "1") {
    const tenant = await requireTenant();
    const today = ukToday();
    let games = 0;
    let told = 0;
    for (const m of await listMatches()) {
      if (!m.sentAt || !m.autoRemind || m.autoRemindedAt || m.calledOff || m.resultLogged || m.date < today) continue;
      // not the morning after it was sent before anyone's had a chance: sent today waits
      if (m.sentAt.slice(0, 10) >= today) continue;
      if (deadlinePassed(m)) continue;
      const due = addDays(m.deadline ? m.deadline.slice(0, 10) : m.date, -m.autoRemind);
      if (today < due) continue;
      told += await tellFamilies(tenant, m, "reminder");
      await markAutoReminded(m.id);
      games++;
    }
    return NextResponse.json({ tenant, games, told });
  }

  // ---- every club, each at its own address ----
  const results: Record<string, unknown> = {};
  for (const tenant of await allTenantIds()) {
    const url = tenant === DEFAULT_TENANT || !rootDomain() ? new URL("/api/cron-fixtures?club=1", req.url).toString() : tenantUrl(tenant, "/api/cron-fixtures?club=1");
    try {
      const res = await fetch(url, { headers: { authorization: auth }, cache: "no-store", signal: AbortSignal.timeout(60_000) });
      // a paused club (423) or one without the hub's data is fine to skip
      results[tenant] = res.ok ? await res.json() : res.status;
    } catch (e) {
      results[tenant] = `failed: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }
  return NextResponse.json({ results });
}
