// The platform's own admin (/platform/admin): whoever runs the platform. Two
// ways in: signed in to their own account with a passkey, when its email is
// one of PLATFORM_ADMIN_EMAILS (an emailed code isn't enough), or with
// PLATFORM_ADMIN_KEY, kept as the way back in. Wrong keys are counted per IP
// address, so it can't be guessed. Server only.
import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { rawKv } from "./kv";
import { clientIp } from "./clientIp";
import { currentPasskeyUser } from "./auth";

const MAX_FAILURES = 10; // an hour, per IP address

const digest = (s: string) => createHash("sha256").update(s).digest();

const keyConfigured = () => (process.env.PLATFORM_ADMIN_KEY ?? "").trim().length >= 12;

/** The accounts that are the platform's admins (their emails, lower case). */
export const platformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const platformAdminConfigured = () => keyConfigured() || platformAdminEmails().length > 0;

/** null if the request may use the platform admin, otherwise why not (and its status). */
export async function platformAdminProblem(req: NextRequest): Promise<{ error: string; status: number } | null> {
  if (!platformAdminConfigured()) {
    return { error: "Set PLATFORM_ADMIN_EMAILS or PLATFORM_ADMIN_KEY (at least 12 characters) to use this page", status: 503 };
  }
  const given = req.headers.get("x-platform-key") ?? "";
  // signed in with a passkey, as one of the platform's admins
  if (!given) {
    const emails = platformAdminEmails();
    const user = emails.length ? await currentPasskeyUser().catch(() => null) : null;
    if (user && emails.includes(user.email.toLowerCase())) return null;
    return { error: "Sign in with your passkey", status: 401 };
  }
  if (!keyConfigured()) return { error: "There's no admin key — sign in with your passkey", status: 401 };
  const kv = await rawKv();
  if (!kv) return { error: "Storage isn't set up", status: 503 };
  const failKey = `platform:admin-fail:${clientIp(req.headers)}`;
  const failures = Number((await kv.get(failKey)) ?? 0);
  if (failures >= MAX_FAILURES) return { error: "Too many wrong keys — try again in an hour", status: 429 };
  if (timingSafeEqual(digest(given), digest(process.env.PLATFORM_ADMIN_KEY!.trim()))) return null;
  const n = await kv.incr(failKey);
  if (n === 1) await kv.expire(failKey, 3600);
  return { error: "That isn't the admin key", status: 401 };
}
