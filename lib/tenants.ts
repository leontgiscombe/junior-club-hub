// The clubs on the platform: each one's web address (its id), name, contact
// email and coach password (scrypt-hashed, never stored as typed). Kept in one
// platform-wide record outside every club's own data. Server only.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { rawKv } from "./kv";
import { DEFAULT_TENANT, RESERVED, TENANT_ID } from "./tenant";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const TENANTS_KEY = "platform:tenants";

export type TenantRecord = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  passwordSalt: string;
  passwordHash: string;
};

/** A club as the public can see it (find-your-club): no email or password. */
export type PublicTenant = { id: string; name: string };

async function hash(password: string, salt: Buffer): Promise<string> {
  return (await scrypt(password, salt, 32)).toString("base64");
}

export async function getTenantRecord(id: string): Promise<TenantRecord | null> {
  if (id === DEFAULT_TENANT) return null;
  const kv = await rawKv();
  if (!kv) return null;
  const raw = await kv.hget<TenantRecord | string>(TENANTS_KEY, id);
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as TenantRecord) : raw;
}

export async function listTenants(): Promise<PublicTenant[]> {
  const kv = await rawKv();
  if (!kv) return [];
  const all = (await kv.hgetall<Record<string, TenantRecord | string>>(TENANTS_KEY)) ?? {};
  return Object.values(all)
    .map((r) => (typeof r === "string" ? (JSON.parse(r) as TenantRecord) : r))
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Why a web address can't be used, or null if it's free. */
export async function addressProblem(id: string): Promise<string | null> {
  if (!TENANT_ID.test(id)) return "Use 1–32 lowercase letters, numbers or dashes";
  if (RESERVED.has(id)) return "That address is reserved";
  if (await getTenantRecord(id)) return "That address is already taken";
  return null;
}

/** Add a club. Returns false if its address was taken meanwhile. */
export async function createTenant(input: { id: string; name: string; email: string; password: string }): Promise<boolean> {
  const kv = await rawKv();
  if (!kv) throw new Error("Storage isn't set up");
  const salt = randomBytes(16);
  const record: TenantRecord = {
    id: input.id,
    name: input.name,
    email: input.email,
    createdAt: new Date().toISOString(),
    passwordSalt: salt.toString("base64"),
    passwordHash: await hash(input.password, salt),
  };
  const added = (await kv.hsetnx(TENANTS_KEY, input.id, JSON.stringify(record))) === 1;
  if (added) known.delete(input.id);
  return added;
}

/** Whether `password` is the club's coach password. */
export async function checkTenantPassword(record: TenantRecord, password: string): Promise<boolean> {
  if (!password) return false;
  const got = Buffer.from(await hash(password, Buffer.from(record.passwordSalt, "base64")));
  const want = Buffer.from(record.passwordHash);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Every club with data: the default one and each signed-up club. */
export async function allTenantIds(): Promise<string[]> {
  return [DEFAULT_TENANT, ...(await listTenants()).map((t) => t.id)];
}

// Whether a club exists, remembered for a minute so every request doesn't
// look it up.
const known = new Map<string, { exists: boolean; at: number }>();

export async function tenantExists(id: string): Promise<boolean> {
  if (id === DEFAULT_TENANT) return true;
  const hit = known.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.exists;
  const exists = !!(await getTenantRecord(id));
  known.set(id, { exists, at: Date.now() });
  return exists;
}

async function saveRecord(record: TenantRecord): Promise<void> {
  const kv = await rawKv();
  if (!kv) throw new Error("Storage isn't set up");
  await kv.hset(TENANTS_KEY, { [record.id]: JSON.stringify(record) });
}

/** Give a club a new coach password. */
export async function setTenantPassword(id: string, password: string): Promise<void> {
  const record = await getTenantRecord(id);
  if (!record) throw new Error("No such club");
  const salt = randomBytes(16);
  await saveRecord({ ...record, passwordSalt: salt.toString("base64"), passwordHash: await hash(password, salt) });
}

/** Change a club's contact email. */
export async function setTenantEmail(id: string, email: string): Promise<void> {
  const record = await getTenantRecord(id);
  if (!record) throw new Error("No such club");
  await saveRecord({ ...record, email });
}

// Password-reset links: a random token, valid for an hour and once only. Only
// its SHA-256 is stored, so the database never holds a working link.
const RESET_TTL_SECONDS = 3600;
const resetKey = (token: string) => `platform:reset:${createHash("sha256").update(token).digest("hex")}`;

export async function createResetToken(tenant: string): Promise<string> {
  const kv = await rawKv();
  if (!kv) throw new Error("Storage isn't set up");
  const token = randomBytes(32).toString("base64url");
  await kv.set(resetKey(token), tenant, { ex: RESET_TTL_SECONDS });
  return token;
}

/** The club a reset token is for, if it's still valid; it can't be used again. */
export async function redeemResetToken(token: string): Promise<string | null> {
  const kv = await rawKv();
  if (!kv || !token) return null;
  const tenant = await kv.getdel<string>(resetKey(token));
  return typeof tenant === "string" ? tenant : null;
}

/** Whether a reset token is still valid, without using it up. */
export async function resetTokenTenant(token: string): Promise<string | null> {
  const kv = await rawKv();
  if (!kv || !token) return null;
  const tenant = await kv.get<string>(resetKey(token));
  return typeof tenant === "string" ? tenant : null;
}
