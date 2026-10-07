// Admin-password check for the protected areas (the /admin landing page, the
// kit admin, and the camera register all share one password).
//
// Each club signed up on the platform has its own coach password (hashed in
// lib/tenants.ts). A single-club hub (the default club) uses the ADMIN_KEY
// environment variable, set in the hosting dashboard; while it isn't set,
// nobody can sign in. Neither is ever stored in the repo.
import crypto from "crypto";
import { headers } from "next/headers";
import { SESSION_KEY } from "./access";
import { clientIp } from "./clientIp";
import { canCoach, currentPerson } from "./people";
import { rawKv } from "./kv";
import { DEFAULT_TENANT, getTenant } from "./tenant";
import { checkTenantPassword, getTenantRecord } from "./tenants";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * The owner's own password for changing the drill library — set as the
 * TRAINING_PLANS_OWNER_KEY environment variable, never in the repo. Coaches
 * with only the admin password build their teams' plans from the library but
 * can't change the drills themselves. While it isn't set, nobody can.
 */
export function checkPlansOwnerKey(supplied: string): boolean {
  const ownerKey = process.env.TRAINING_PLANS_OWNER_KEY;
  if (!ownerKey) return false;
  return safeEqual(String(supplied || ""), ownerKey);
}

export const isPlansOwnerKeySet = () => !!process.env.TRAINING_PLANS_OWNER_KEY;

/**
 * Whether changing the drill library needs the owner's password. Only on a
 * single-club hub with TRAINING_PLANS_OWNER_KEY set (a drill pack the owner
 * looks after); everywhere else a club's coaches manage their own library.
 */
export async function drillsNeedOwnerKey(): Promise<boolean> {
  return isPlansOwnerKeySet() && (await getTenant()) === DEFAULT_TENANT;
}

/**
 * Returns true if `supplied` matches the admin password (the ADMIN_KEY
 * environment variable, passed in as `envOverride`). With no password set,
 * nothing matches.
 */
export function checkAdminPassword(supplied: string, envOverride?: string): boolean {
  if (!envOverride) return false;
  return safeEqual(String(supplied || ""), envOverride);
}

// Wrong coach passwords are counted per club and IP address; after too many,
// that address can't sign in for a while, so a club's password can't be
// guessed. (A screen can send two requests per attempt, hence the allowance.)
const MAX_WRONG = 20;
const LOCKOUT_SECONDS = 15 * 60;

async function failKey(tenant: string): Promise<string> {
  const ip = clientIp(await headers());
  return `platform:coach-fail:${tenant}:${ip}`;
}

/** Whether this address has had too many wrong coach passwords for this club lately. */
export async function coachLockedOut(): Promise<boolean> {
  const tenant = await getTenant();
  const kv = await rawKv();
  if (!tenant || !kv) return false;
  try {
    return Number((await kv.get(await failKey(tenant))) ?? 0) >= MAX_WRONG;
  } catch {
    return false;
  }
}

/**
 * Whether `supplied` is the coach password of the club this request is for —
 * or SESSION_KEY from someone signed in as one of its admins or coaches.
 */
export async function isCoach(supplied: string): Promise<boolean> {
  const tenant = await getTenant();
  if (!tenant) return false;
  // no password given isn't a guess (public pages ask without one)
  if (!supplied) return false;
  // signed in with an account: a club admin or coach here needs no password
  if (supplied === SESSION_KEY) {
    try {
      const me = await currentPerson(tenant);
      return canCoach(me?.person ?? null);
    } catch {
      return false;
    }
  }
  if (await coachLockedOut()) return false;
  let ok: boolean;
  if (tenant === DEFAULT_TENANT) ok = checkAdminPassword(supplied, process.env.ADMIN_KEY);
  else {
    const record = await getTenantRecord(tenant);
    ok = record ? await checkTenantPassword(record, String(supplied)) : false;
  }
  if (!ok) {
    const kv = await rawKv();
    if (kv) {
      try {
        const key = await failKey(tenant);
        if ((await kv.incr(key)) === 1) await kv.expire(key, LOCKOUT_SECONDS);
      } catch {}
    }
  }
  return ok;
}
