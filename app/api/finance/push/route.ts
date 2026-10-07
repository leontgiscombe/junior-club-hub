// Saves or removes a browser's push subscription for the monthly subs
// reminder. A subscription is only a push endpoint — no personal details.
import { NextRequest, NextResponse } from "next/server";
import { PUSH_SUBS_KEY, financeConfigured, redis } from "@/lib/financeStorage";
import { isTeam } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Sub = { endpoint?: string; keys?: unknown };

async function removeEndpoint(endpoint: string) {
  const members = ((await redis(["SMEMBERS", PUSH_SUBS_KEY])) as string[] | null) ?? [];
  for (const m of members) {
    try {
      if ((JSON.parse(m) as Sub).endpoint === endpoint) await redis(["SREM", PUSH_SUBS_KEY, m]);
    } catch {}
  }
}

async function handle(req: NextRequest, add: boolean) {
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { subscription?: Sub; team?: string } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint) return NextResponse.json({ error: "missing subscription" }, { status: 400 });
  try {
    // Drop any earlier record for this browser, then add the fresh one.
    await removeEndpoint(sub.endpoint);
    if (add) {
      const team = body?.team && (await isTeam(body.team)) ? body.team : "";
      const record = { endpoint: sub.endpoint, keys: sub.keys, team, addedAt: new Date().toISOString() };
      await redis(["SADD", PUSH_SUBS_KEY, JSON.stringify(record)]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

export const POST = (req: NextRequest) => handle(req, true);
export const DELETE = (req: NextRequest) => handle(req, false);
