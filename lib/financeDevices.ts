// Opening Financial Admin with an account instead of a team password, the way
// WhatsApp links devices. Each phone or computer makes its own key pair in the
// browser (the private key never leaves it). Once the device is unlocked with
// the team password — or approved by a treasurer or club admin whose device is
// already unlocked — it gets its own copy of the team's data key, locked to
// its public key. The server only ever holds those locked copies, so it still
// can't read a team's records. Treasurers and club admins can use this.
// Server only.
import { financeKeys, redis } from "./financeStorage";
import { currentPerson } from "./people";
import type { User } from "./auth";

export type Wrapped = { epk: JsonWebKey; iv: string; ct: string };
export type FinanceDevice = {
  id: string;
  userId: string;
  userName: string;
  /** e.g. "iPhone · Safari" */
  label: string;
  publicKey: JsonWebKey;
  /** the team's data key, locked to this device; none yet = waiting for approval */
  wrapped?: Wrapped;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
};

export const FINANCE_ROLES = ["treasurer", "admin"] as const;
export const DEVICE_ID = /^[\w-]{8,40}$/;

/** The signed-in person (with their name at this club), if they can use Financial Admin with their account here. */
export async function financeUser(tenant: string): Promise<User | null> {
  const me = await currentPerson(tenant).catch(() => null);
  if (!me?.person || me.person.status !== "approved") return null;
  if (!me.person.roles.some((r) => (FINANCE_ROLES as readonly string[]).includes(r))) return null;
  return { ...me.user, name: me.person.name || me.user.name };
}

export async function listDevices(tenant: string, team: string): Promise<FinanceDevice[]> {
  const flat = ((await redis(["HGETALL", financeKeys(tenant).devices(team)])) as string[] | null) ?? [];
  const out: FinanceDevice[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i]) as FinanceDevice);
    } catch {}
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDevice(tenant: string, team: string, id: string): Promise<FinanceDevice | null> {
  const raw = await redis(["HGET", financeKeys(tenant).devices(team), id]);
  return typeof raw === "string" ? (JSON.parse(raw) as FinanceDevice) : null;
}

export async function saveDevice(tenant: string, team: string, device: FinanceDevice): Promise<void> {
  await redis(["HSET", financeKeys(tenant).devices(team), device.id, JSON.stringify(device)]);
}

export async function removeDevice(tenant: string, team: string, id: string): Promise<void> {
  await redis(["HDEL", financeKeys(tenant).devices(team), id]);
}

/** Forget every device of a team (after its records are deleted and it starts again). */
export async function clearDevices(tenant: string, team: string): Promise<void> {
  await redis(["DEL", financeKeys(tenant).devices(team)]);
}

const isJwk = (v: unknown): v is JsonWebKey =>
  !!v && typeof v === "object" && (v as JsonWebKey).kty === "EC" && typeof (v as JsonWebKey).x === "string" && typeof (v as JsonWebKey).y === "string";

/** A public key from a request (P-256, public parts only). */
export function cleanPublicKey(v: unknown): JsonWebKey | null {
  if (!isJwk(v) || v.crv !== "P-256") return null;
  return { kty: "EC", crv: "P-256", x: v.x, y: v.y };
}

/** A locked data key from a request. */
export function cleanWrapped(v: unknown): Wrapped | null {
  if (!v || typeof v !== "object") return null;
  const w = v as Record<string, unknown>;
  const epk = cleanPublicKey(w.epk);
  if (!epk || typeof w.iv !== "string" || typeof w.ct !== "string" || w.ct.length > 500) return null;
  return { epk, iv: w.iv, ct: w.ct };
}
