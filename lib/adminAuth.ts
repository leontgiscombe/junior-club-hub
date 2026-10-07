// Admin-password check for the protected areas (the /admin landing page, the
// kit admin, and the camera register all share one password).
//
// The password is the ADMIN_KEY environment variable, set in the hosting
// dashboard. It is never stored in the repo; while it isn't set, nobody can
// sign in.
import crypto from "crypto";

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
