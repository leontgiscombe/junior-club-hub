// Admin-password check for the protected areas (the /admin landing page, the
// kit admin, and the camera register all share one password).
//
// Each club signed up on the platform has its own coach password (hashed in
// lib/tenants.ts). A single-club hub (the default club) uses the ADMIN_KEY
// environment variable, set in the hosting dashboard; while it isn't set,
// nobody can sign in. Neither is ever stored in the repo.
import crypto from "crypto";
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
 * Returns true if `supplied` matches the admin password (the ADMIN_KEY
 * environment variable, passed in as `envOverride`). With no password set,
 * nothing matches.
 */
export function checkAdminPassword(supplied: string, envOverride?: string): boolean {
  if (!envOverride) return false;
  return safeEqual(String(supplied || ""), envOverride);
}

/** Whether `supplied` is the coach password of the club this request is for. */
export async function isCoach(supplied: string): Promise<boolean> {
  const tenant = await getTenant();
  if (!tenant) return false;
  if (tenant === DEFAULT_TENANT) return checkAdminPassword(supplied, process.env.ADMIN_KEY);
  const record = await getTenantRecord(tenant);
  return record ? checkTenantPassword(record, String(supplied || "")) : false;
}
