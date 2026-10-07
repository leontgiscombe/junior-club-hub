// The database's address and token, from the environment. No imports, so the
// proxy can use it too.

/**
 * The database's REST address and token: Vercel's names (KV_REST_API_…) or
 * Upstash's own (UPSTASH_REDIS_REST_…). Null if either is missing, or if the
 * address isn't the REST one — Upstash also shows a redis:// address, which
 * this client can't use.
 */
export function kvCredentials(): { url: string; token: string } | null {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  // (plain http only for a database on this computer, when trying things out)
  if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
    if (!warned) {
      warned = true;
      console.error("The database address must be Upstash's REST URL (https://….upstash.io), not its redis:// one");
    }
    return null;
  }
  return { url, token };
}
let warned = false;
