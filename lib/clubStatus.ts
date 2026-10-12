// Two things the proxy checks on a club's pages (kept small, as it asks on
// every request): whether the platform admin has paused the club, and
// noting when it was last used (at most once an hour per club, per server),
// for the platform admin's dashboard. Nothing about who used it is kept.
import { kvCall } from "./access";
import { DEFAULT_TENANT } from "./tenantHost";

export const activeKey = (tenant: string) => `platform:club-active:${tenant}`;
const TENANTS_KEY = "platform:tenants";

const noted = new Map<string, number>();
const HOUR = 3600_000;

/** Remember that `tenant`'s hub was just used (fire and forget). */
export function noteActive(tenant: string): void {
  if (tenant === DEFAULT_TENANT) return;
  const last = noted.get(tenant) ?? 0;
  if (Date.now() - last < HOUR) return;
  noted.set(tenant, Date.now());
  if (noted.size > 5000) noted.clear();
  kvCall(["SET", activeKey(tenant), new Date().toISOString()]).catch(() => noted.delete(tenant));
}

export type Paused = { at: string; reason?: string };
const pausedCache = new Map<string, { at: number; paused: Paused | null }>();

/** Whether the platform admin has paused `tenant` (remembered for 30 seconds). */
export async function pausedClub(tenant: string): Promise<Paused | null> {
  if (tenant === DEFAULT_TENANT) return null;
  const hit = pausedCache.get(tenant);
  if (hit && Date.now() - hit.at < 30_000) return hit.paused;
  const raw = await kvCall<string | null>(["HGET", TENANTS_KEY, tenant]);
  let paused: Paused | null = null;
  try {
    paused = (raw ? (JSON.parse(raw) as { paused?: Paused }).paused : null) ?? null;
  } catch {}
  if (pausedCache.size > 5000) pausedCache.clear();
  pausedCache.set(tenant, { at: Date.now(), paused });
  return paused;
}
