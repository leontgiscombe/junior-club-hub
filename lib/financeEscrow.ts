// Opening a team's Financial Admin without its password: the server keeps a
// copy of each team's data key, locked with a key only the server has
// (FINANCE_KEY_SECRET), and gives it to the team's own treasurer or a club
// admin once they're signed in and (with a passkey on their account) have
// passed Face ID or a fingerprint (app/api/finance/escrow). The team password
// still works too. Anyone who opens a team leaves its key here, so it works
// for every team after its first opening since this was added. Only a key
// that really opens the team's records is kept. Server only.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { financeKeys, redis } from "./financeStorage";
import { teamRecord } from "./financeTeam";

type Locked = { iv: string; ct: string; tag: string };

/** The server's key for team keys: FINANCE_KEY_SECRET, or (unset) one made from the database's token. */
function serverKey(): Buffer {
  const secret = process.env.FINANCE_KEY_SECRET?.trim() || `finance-escrow:${process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ""}`;
  return createHash("sha256").update(secret).digest();
}

/** Whether `key` opens the team's encrypted records (AES-GCM, as the page encrypts them). */
function opens(key: Buffer, blob: unknown): boolean {
  const b = blob as { iv?: unknown; ct?: unknown } | null;
  if (!b || typeof b.iv !== "string" || typeof b.ct !== "string") return false;
  try {
    const ct = Buffer.from(b.ct, "base64");
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(b.iv, "base64"));
    d.setAuthTag(ct.subarray(ct.length - 16));
    d.update(ct.subarray(0, ct.length - 16));
    d.final();
    return true;
  } catch {
    return false;
  }
}

/** Keep `key` for the team, if it opens its records. */
export async function saveTeamKey(tenant: string, team: string, key: Buffer): Promise<boolean> {
  if (key.length !== 32) return false;
  const { blob } = await teamRecord(tenant, team);
  if (!opens(key, blob)) return false;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", serverKey(), iv);
  const ct = Buffer.concat([c.update(key), c.final()]);
  const locked: Locked = { iv: iv.toString("base64"), ct: ct.toString("base64"), tag: c.getAuthTag().toString("base64") };
  await redis(["SET", financeKeys(tenant).escrow(team), JSON.stringify(locked)]);
  return true;
}

/** The team's key, if one is kept and still opens its records (a team reset without its recovery code has a new one). */
export async function teamKey(tenant: string, team: string): Promise<Buffer | null> {
  const raw = await redis(["GET", financeKeys(tenant).escrow(team)]);
  if (typeof raw !== "string") return null;
  try {
    const l = JSON.parse(raw) as Locked;
    const d = createDecipheriv("aes-256-gcm", serverKey(), Buffer.from(l.iv, "base64"));
    d.setAuthTag(Buffer.from(l.tag, "base64"));
    const key = Buffer.concat([d.update(Buffer.from(l.ct, "base64")), d.final()]);
    const { blob } = await teamRecord(tenant, team);
    return opens(key, blob) ? key : null;
  } catch {
    return null;
  }
}
