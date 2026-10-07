// Storage for Financial Admin (/finance), with plain Redis commands: each
// team's encrypted data at "{prefix}:v1:{team}", its login record (encryption
// salt and password verifier, never the password) at "{prefix}:v1:auth:{team}",
// and reminder subscriptions at "{prefix}:push:subs" — all under the club's
// own key prefix (lib/kv.ts). The data is encrypted in the browser with the
// team's password; the server only sees the blob.
import { CLUB } from "@/club.config";
import { keyPrefix } from "./kv";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const financeConfigured = () => !!(REDIS_URL && REDIS_TOKEN);

/** Where a club's Financial Admin data is kept. */
export function financeKeys(tenant: string) {
  const p = `${keyPrefix(tenant)}${CLUB.storagePrefix}`;
  return {
    data: (team: string) => `${p}:v1:${team}`,
    auth: (team: string) => `${p}:v1:auth:${team}`,
    pushSubs: `${p}:push:subs`,
  };
}

export async function redis(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return ((await r.json()) as { result: unknown }).result;
}
