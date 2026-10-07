// Storage for Financial Admin (/finance), with plain Redis commands: each
// team's encrypted data at "{prefix}:v1:{team}", its login record (encryption
// salt and password verifier, never the password) at "{prefix}:v1:auth:{team}",
// and reminder subscriptions at "{prefix}:push:subs". The data is encrypted in
// the browser with the team's password; the server only sees the blob.
import { CLUB } from "@/club.config";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const financeConfigured = () => !!(REDIS_URL && REDIS_TOKEN);


const P = CLUB.storagePrefix;
export const financeDataKey = (team: string) => `${P}:v1:${team}`;
export const financeAuthKey = (team: string) => `${P}:v1:auth:${team}`;
export const PUSH_SUBS_KEY = `${P}:push:subs`;

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
