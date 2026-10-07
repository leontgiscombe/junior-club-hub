// The platform's own admin (/platform/admin): whoever runs the platform signs
// in with PLATFORM_ADMIN_KEY. Wrong keys are counted per IP address, so it
// can't be guessed. Server only.
import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { rawKv } from "./kv";

const MAX_FAILURES = 10; // an hour, per IP address

const digest = (s: string) => createHash("sha256").update(s).digest();

export const platformAdminConfigured = () => (process.env.PLATFORM_ADMIN_KEY ?? "").trim().length >= 12;

/** null if the request carries the admin key, otherwise why not (and its status). */
export async function platformAdminProblem(req: NextRequest): Promise<{ error: string; status: number } | null> {
  if (!platformAdminConfigured()) {
    return { error: "Set PLATFORM_ADMIN_KEY (at least 12 characters) to use this page", status: 503 };
  }
  const kv = await rawKv();
  if (!kv) return { error: "Storage isn't set up", status: 503 };
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const failKey = `platform:admin-fail:${ip}`;
  const failures = Number((await kv.get(failKey)) ?? 0);
  if (failures >= MAX_FAILURES) return { error: "Too many wrong keys — try again in an hour", status: 429 };
  const given = req.headers.get("x-platform-key") ?? "";
  if (given && timingSafeEqual(digest(given), digest(process.env.PLATFORM_ADMIN_KEY!.trim()))) return null;
  const n = await kv.incr(failKey);
  if (n === 1) await kv.expire(failKey, 3600);
  return { error: "That isn't the admin key", status: 401 };
}
