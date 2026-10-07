// The database, as each club sees it. Every key a club's data is stored under
// gets the club's prefix ("t:riverside:…"), so clubs sharing one database never
// see each other's data. The default club keeps its keys unprefixed, exactly
// where a single-club hub has always stored them.
import type { VercelKV } from "@vercel/kv";
import { DEFAULT_TENANT, requireTenant } from "./tenant";
import { tenantExists } from "./tenants";

/** The commands the hub uses, each with its key(s) as the first argument(s). */
type KvCommands = Pick<
  VercelKV,
  "get" | "set" | "del" | "hget" | "hset" | "hgetall" | "hdel" | "lpush" | "lrange" | "lrem" | "sadd" | "srem" | "smembers"
>;

/** The database itself, unprefixed — for the platform's own records. */
export async function rawKv(): Promise<VercelKV | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

export const keyPrefix = (tenant: string) => (tenant === DEFAULT_TENANT ? "" : `t:${tenant}:`);

/** The database for `tenant` (by default, the club this request is for). */
export async function getKv(tenant?: string): Promise<KvCommands | null> {
  const kv = await rawKv();
  if (!kv) return null;
  const t = tenant ?? (await requireTenant());
  // nothing is read or written for an address that isn't a club
  if (!(await tenantExists(t))) throw new Error(`No club at "${t}"`);
  const prefix = keyPrefix(t);
  if (!prefix) return kv;
  const k = (key: unknown) => `${prefix}${String(key)}`;
  const one =
    (name: keyof KvCommands) =>
    (key: unknown, ...rest: unknown[]) =>
      (kv[name] as (...a: unknown[]) => unknown).call(kv, k(key), ...rest);
  return {
    get: one("get"),
    set: one("set"),
    del: (...keys: string[]) => kv.del(...keys.map(k)),
    hget: one("hget"),
    hset: one("hset"),
    hgetall: one("hgetall"),
    hdel: one("hdel"),
    lpush: one("lpush"),
    lrange: one("lrange"),
    lrem: one("lrem"),
    sadd: one("sadd"),
    srem: one("srem"),
    smembers: one("smembers"),
  } as KvCommands;
}
