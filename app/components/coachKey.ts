// How the coach screens know who's using them: someone signed in with an
// account (a club admin or coach) needs no password, and their links carry
// none; someone using the club's coach password types it once — in Coach
// Admin or any tool — and every tool opens with it until the app is closed
// (it's kept for this browser session only, never longer). Links still carry
// it (?key=…), as before.
import { SESSION_KEY } from "@/lib/access";

const STORE = "hub_coach_key";

/** The query string for a coach link: nothing for an account, ?key=… for the password. */
export function keyQuery(key: string, extra = ""): string {
  if (key === SESSION_KEY || !key) return extra ? `?${extra}` : "";
  return `?key=${encodeURIComponent(key)}${extra ? `&${extra}` : ""}`;
}

/** Remember a coach password that worked, for the other tools, until the app is closed. */
export function rememberCoachKey(key: string) {
  if (!key || key === SESSION_KEY) return;
  try {
    sessionStorage.setItem(STORE, key);
  } catch {}
}

function storedCoachKey(): string | null {
  try {
    return sessionStorage.getItem(STORE);
  } catch {
    return null;
  }
}

/**
 * The key to open a coach screen with, without asking: SESSION_KEY if someone
 * signed in here can use the coach screens, else the coach password given
 * earlier in this session, else null.
 */
export async function accountKey(): Promise<string | null> {
  const me = await fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null);
  return me?.canCoach ? SESSION_KEY : storedCoachKey();
}
