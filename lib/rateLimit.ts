// Counting a visitor's tries at something over a window, so a script can't
// flood a public form or keep guessing a password. Counts live in the main
// database under platform:rate:… and run out on their own.
import { headers } from "next/headers";
import { clientIp } from "./clientIp";
import { rawKv } from "./kv";
import { getTenant } from "./tenant";

/**
 * Counts one more try at `what` from this visitor (by IP address, per club),
 * and says whether they've now gone over `max` in `seconds`. Lets the try
 * through when the database can't be reached, rather than locking everyone out.
 */
export async function overLimit(what: string, max: number, seconds: number, perClub = true): Promise<boolean> {
  const kv = await rawKv();
  if (!kv) return false;
  try {
    // perClub false: one count for the visitor across every address (any
    // made-up club address would otherwise start them a fresh count)
    const key = `platform:rate:${what}:${perClub ? ((await getTenant()) ?? "-") : "*"}:${clientIp(await headers())}`;
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, seconds);
    return n > max;
  } catch {
    return false;
  }
}

/** Whether this visitor has already gone over `max` tries at `what` — without counting one. */
export async function atLimit(what: string, max: number): Promise<boolean> {
  const kv = await rawKv();
  if (!kv) return false;
  try {
    const key = `platform:rate:${what}:${(await getTenant()) ?? "-"}:${clientIp(await headers())}`;
    return Number((await kv.get(key)) ?? 0) >= max;
  } catch {
    return false;
  }
}
