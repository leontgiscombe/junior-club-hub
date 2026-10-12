// Reading a team's Financial Admin record (app/api/finance). Who gets what:
// the encrypted data and the password checks go only to someone who knows the
// team password (shown by its write token) or a signed-in treasurer or club
// admin. Everyone else gets lockedAuth — enough to work the token out from a
// password, nothing to test passwords against offline. Server only.
import { createHash, timingSafeEqual } from "crypto";
import type { Auth } from "./financeAuth";
import { financeKeys, redis } from "./financeStorage";

// Wrong team passwords from one address, per club, in an hour
export const UNLOCK_FAILS = 10;

const parse = <T,>(v: unknown): T | null => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("base64");

/** Whether `token` hashes to `hash` (a team's writeHash). */
export function sameToken(token: string, hash: string | undefined): boolean {
  if (!token || !hash) return false;
  const a = sha256(token);
  return a.length === hash.length && timingSafeEqual(Buffer.from(a), Buffer.from(hash));
}

/** Whether `token` is the team's write token — which only the team password gives. */
export const tokenMatches = (auth: Auth | null, token: string) => sameToken(token, auth?.writeHash);

/**
 * What anyone may see of a team's login record: the salt for working out its
 * write token, and the recovery-code lock (a 20-character random code can't be
 * guessed). Not the password checks or the data.
 */
export function lockedAuth(auth: Auth) {
  return {
    locked: true,
    ...(auth.v ? { v: auth.v } : {}),
    writeSalt: auth.writeSalt,
    ...(auth.recSalt && auth.wrapRec ? { recSalt: auth.recSalt, wrapRec: auth.wrapRec } : {}),
  };
}

/** The team's whole record: its encrypted data and login record. */
export async function teamRecord(tenant: string, id: string) {
  const keys = financeKeys(tenant);
  const [val, authVal] = await Promise.all([redis(["GET", keys.data(id)]), redis(["GET", keys.auth(id)])]);
  const rec = parse<{ blob?: unknown; rev?: number; updatedAt?: string }>(val) ?? {};
  return {
    blob: rec.blob ?? null,
    rev: rec.rev ?? 0,
    updatedAt: rec.updatedAt ?? null,
    auth: parse<Auth>(authVal),
  };
}
