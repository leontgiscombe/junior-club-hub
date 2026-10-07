// How the coach screens know who's using them: someone signed in with an
// account (a club admin or coach) needs no password, and their links carry
// none; someone using the club's coach password still has it in the link
// (?key=…), as before.
import { SESSION_KEY } from "@/lib/access";

/** The query string for a coach link: nothing for an account, ?key=… for the password. */
export function keyQuery(key: string, extra = ""): string {
  if (key === SESSION_KEY || !key) return extra ? `?${extra}` : "";
  return `?key=${encodeURIComponent(key)}${extra ? `&${extra}` : ""}`;
}

/** SESSION_KEY if someone signed in here can use the coach screens, else null. */
export async function accountKey(): Promise<string | null> {
  const me = await fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null);
  return me?.canCoach ? SESSION_KEY : null;
}
