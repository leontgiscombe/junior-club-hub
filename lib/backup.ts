// Nightly backups: a copy of everything in the database, kept for 7 days. Each
// key is copied to "backup:<date>:<key>" in the backup database — a second
// Upstash database if BACKUP_KV_REST_API_URL and BACKUP_KV_REST_API_TOKEN are
// set (best: it survives the main one), otherwise the main database itself
// (still covers a club's data being deleted or overwritten by mistake). Every
// copy expires on its own after 8 days. Server only.
import { kvCredentials } from "./kv";
import { reclaimCode } from "./members";

type Creds = { url: string; token: string };
type Cmd = (string | number)[];

const KEEP_DAYS = 7;
const EXPIRE_SECONDS = (KEEP_DAYS + 1) * 24 * 3600;
// what isn't worth keeping: older backups and short-lived counters and links
const SKIP =
  /^(backup:|platform:(reset:|reset-requests:|signup-ip:|lookup-ip:|admin-fail:|coach-fail:|join-ip:|join-email:|signin-ip:|signin-email:|login:|login-email:|session:))/;
// keep each request well under Upstash's size limit
const MAX_BATCH_BYTES = 700 * 1024;

export function backupCredentials(): Creds | null {
  const url = (process.env.BACKUP_KV_REST_API_URL ?? "").trim();
  const token = (process.env.BACKUP_KV_REST_API_TOKEN ?? "").trim();
  return url && token ? { url, token } : kvCredentials();
}
export const separateBackupDb = () =>
  !!(process.env.BACKUP_KV_REST_API_URL?.trim() && process.env.BACKUP_KV_REST_API_TOKEN?.trim());

async function call<T = unknown>(creds: Creds, cmd: Cmd): Promise<T> {
  const res = await fetch(creds.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`database ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

async function pipeline(creds: Creds, cmds: Cmd[]): Promise<unknown[]> {
  if (!cmds.length) return [];
  const res = await fetch(`${creds.url.replace(/\/+$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`database ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  const failed = out.find((r) => r.error);
  if (failed) throw new Error(failed.error);
  return out.map((r) => r.result);
}

/** Run writes in batches small enough for one request each. */
async function writeAll(creds: Creds, cmds: Cmd[]): Promise<void> {
  let batch: Cmd[] = [];
  let size = 0;
  for (const c of cmds) {
    const bytes = JSON.stringify(c).length;
    if (batch.length && (size + bytes > MAX_BATCH_BYTES || batch.length >= 200)) {
      await pipeline(creds, batch);
      batch = [];
      size = 0;
    }
    batch.push(c);
    size += bytes;
  }
  await pipeline(creds, batch);
}

async function scanKeys(creds: Creds, match: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, found] = await call<[string, string[]]>(creds, ["SCAN", cursor, "MATCH", match, "COUNT", 1000]);
    keys.push(...found);
    cursor = String(next);
  } while (cursor !== "0");
  return keys;
}

/** The commands that recreate `keys` from `from` as `rename(key)` (with an expiry, if given). */
async function copyCommands(from: Creds, keys: string[], rename: (k: string) => string, expire?: number): Promise<Cmd[]> {
  const out: Cmd[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const types = (await pipeline(from, chunk.map((k) => ["TYPE", k]))) as string[];
    const reads: Cmd[] = chunk.map((k, j) =>
      types[j] === "hash" ? ["HGETALL", k] : types[j] === "list" ? ["LRANGE", k, 0, -1] : types[j] === "set" ? ["SMEMBERS", k] : ["GET", k],
    );
    const values = await pipeline(from, reads);
    chunk.forEach((k, j) => {
      const to = rename(k);
      const v = values[j];
      const type = types[j];
      out.push(["DEL", to]);
      if (type === "string" && typeof v === "string") out.push(["SET", to, v]);
      else if (type === "hash" && Array.isArray(v) && v.length) out.push(["HSET", to, ...(v as string[])]);
      else if (type === "list" && Array.isArray(v) && v.length) out.push(["RPUSH", to, ...(v as string[])]);
      else if (type === "set" && Array.isArray(v) && v.length) out.push(["SADD", to, ...(v as string[])]);
      else return;
      if (expire) out.push(["EXPIRE", to, expire]);
    });
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);
const metaKey = (date: string) => `backup:${date}:_meta`;

/** Back up the whole database for today. */
export async function runBackup(): Promise<{ date: string; keys: number; separate: boolean }> {
  const from = kvCredentials();
  const to = backupCredentials();
  if (!from || !to) throw new Error("Storage isn't set up");
  const date = today();
  const keys = (await scanKeys(from, "*")).filter((k) => !SKIP.test(k));
  const cmds = await copyCommands(from, keys, (k) => `backup:${date}:${k}`, EXPIRE_SECONDS);
  await writeAll(to, cmds);
  await call(to, ["SET", metaKey(date), JSON.stringify({ at: new Date().toISOString(), keys: keys.length }), "EX", EXPIRE_SECONDS]);
  return { date, keys: keys.length, separate: separateBackupDb() };
}

/** The backups there are, newest first. */
export async function listBackups(): Promise<{ date: string; at: string; keys: number }[]> {
  const to = backupCredentials();
  if (!to) return [];
  const dates = Array.from({ length: KEEP_DAYS + 1 }, (_, i) =>
    new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const metas = (await pipeline(to, dates.map((d) => ["GET", metaKey(d)]))) as (string | null)[];
  return dates.flatMap((date, i) => {
    if (typeof metas[i] !== "string") return [];
    const m = JSON.parse(metas[i]!) as { at: string; keys: number };
    return [{ date, at: m.at, keys: m.keys }];
  });
}

/**
 * Put one club back as it was in the backup on `date`: its sign-in record and
 * all its data (anything it has now is replaced). Works for a deleted club too.
 * Returns how many records were restored, or null if the backup doesn't have it.
 */
export async function restoreClub(id: string, date: string): Promise<number | null> {
  const main = kvCredentials();
  const backup = backupCredentials();
  if (!main || !backup) throw new Error("Storage isn't set up");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const record = await call<string | null>(backup, ["HGET", `backup:${date}:platform:tenants`, id]);
  if (!record) return null;
  const prefix = `backup:${date}:`;
  const saved = await scanKeys(backup, `${prefix}t:${id}:*`);
  const current = await scanKeys(main, `t:${id}:*`);
  const cmds: Cmd[] = [];
  for (let i = 0; i < current.length; i += 200) cmds.push(["DEL", ...current.slice(i, i + 200)]);
  cmds.push(...(await copyCommands(backup, saved, (k) => k.slice(prefix.length))));
  cmds.push(["HSET", "platform:tenants", id, record]);
  await writeAll(main, cmds);
  // its join code works again (unless another club has had it since)
  await reclaimCode(id);
  return saved.length;
}
