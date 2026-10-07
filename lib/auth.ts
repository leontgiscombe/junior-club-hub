// Accounts: one per person (by email), for every club they belong to. No
// passwords — you sign in with a link or 6-digit code sent to your email, and
// stay signed in on that device (a session cookie) for 90 days. Server only.
//
//   platform:user:<id>              the account: { id, email, name, createdAt }
//   platform:user-by-email          email -> id
//   platform:user-sessions:<id>     its sessions (their hashes), to sign out everywhere
//   platform:user-clubs:<id>        the clubs it belongs to
//   platform:session:<hash>         a signed-in device: { userId }
//   platform:login:<id>             a sign-in waiting to be finished (15 minutes)
//   platform:login-email:<email>    the latest one for an email, for typing the code
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { SESSION_COOKIE, kvCall, sessionKey, hashToken, sessionUserId } from "./access";
import { rootDomain } from "./tenantHost";

export type User = { id: string; email: string; name: string; createdAt: string };

const SESSION_DAYS = 90;
const LOGIN_SECONDS = 15 * 60;
const MAX_CODE_TRIES = 5;

const userKey = (id: string) => `platform:user:${id}`;
const USERS_BY_EMAIL = "platform:user-by-email";
const userSessionsKey = (id: string) => `platform:user-sessions:${id}`;
export const userClubsKey = (id: string) => `platform:user-clubs:${id}`;
const loginKey = (id: string) => `platform:login:${id}`;
const loginEmailKey = (email: string) => `platform:login-email:${email}`;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const cleanEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase().slice(0, 120) : "");
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parse = <T,>(v: unknown): T | null => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

export async function getUser(id: string): Promise<User | null> {
  return parse<User>(await kvCall(["GET", userKey(id)]));
}

async function userByEmail(email: string): Promise<User | null> {
  const id = await kvCall<string | null>(["HGET", USERS_BY_EMAIL, email]);
  return typeof id === "string" ? getUser(id) : null;
}

/** The account for `email`, made the first time someone signs in with it. */
async function findOrCreateUser(email: string): Promise<User> {
  const existing = await userByEmail(email);
  if (existing) return existing;
  const user: User = { id: randomBytes(9).toString("base64url"), email, name: "", createdAt: new Date().toISOString() };
  if ((await kvCall<number>(["HSETNX", USERS_BY_EMAIL, email, user.id])) !== 1) return (await userByEmail(email))!;
  await kvCall(["SET", userKey(user.id), JSON.stringify(user)]);
  return user;
}

export async function setUserName(id: string, name: string): Promise<User | null> {
  const user = await getUser(id);
  if (!user) return null;
  const next = { ...user, name: name.trim().slice(0, 60) };
  await kvCall(["SET", userKey(id), JSON.stringify(next)]);
  return next;
}

/**
 * Start signing in: a link (for this site) and a 6-digit code, both good for
 * 15 minutes, to email to `email`. The link holds a secret; the code is tried
 * at most 5 times.
 */
export async function startLogin(email: string, next: string): Promise<{ loginId: string; token: string; code: string }> {
  const loginId = randomBytes(9).toString("base64url");
  const token = randomBytes(24).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await kvCall([
    "SET",
    loginKey(loginId),
    JSON.stringify({ email, tokenHash: sha(token), codeHash: sha(`${loginId}:${code}`), tries: 0, next }),
    "EX",
    LOGIN_SECONDS,
  ]);
  await kvCall(["SET", loginEmailKey(email), loginId, "EX", LOGIN_SECONDS]);
  return { loginId, token, code };
}

type Login = { email: string; tokenHash: string; codeHash: string; tries: number; next: string };

/** Finish signing in from the email's link. The account and where to go next, or null. */
export async function finishLoginWithLink(loginId: string, token: string): Promise<{ user: User; next: string } | null> {
  const login = parse<Login>(await kvCall(["GET", loginKey(loginId)]));
  if (!login || !token || !same(sha(token), login.tokenHash)) return null;
  await kvCall(["DEL", loginKey(loginId), loginEmailKey(login.email)]);
  return { user: await findOrCreateUser(login.email), next: login.next };
}

/** Finish signing in by typing the code from the email. */
export async function finishLoginWithCode(email: string, code: string): Promise<{ user: User; next: string } | null> {
  const loginId = await kvCall<string | null>(["GET", loginEmailKey(email)]);
  if (typeof loginId !== "string") return null;
  const login = parse<Login>(await kvCall(["GET", loginKey(loginId)]));
  if (!login) return null;
  if (!same(sha(`${loginId}:${code.replace(/\D/g, "")}`), login.codeHash)) {
    if (login.tries + 1 >= MAX_CODE_TRIES) await kvCall(["DEL", loginKey(loginId), loginEmailKey(email)]);
    else await kvCall(["SET", loginKey(loginId), JSON.stringify({ ...login, tries: login.tries + 1 }), "KEEPTTL"]);
    return null;
  }
  await kvCall(["DEL", loginKey(loginId), loginEmailKey(email)]);
  return { user: await findOrCreateUser(login.email), next: login.next };
}

/** A new signed-in session for `user`: its token, for the cookie. */
export async function createSession(user: User): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = await hashToken(token);
  await kvCall(["SET", sessionKey(hash), JSON.stringify({ userId: user.id, at: new Date().toISOString() }), "EX", SESSION_DAYS * 86400]);
  await kvCall(["SADD", userSessionsKey(user.id), hash]);
  return token;
}

/**
 * The session cookie's settings. On the platform's own domain it covers every
 * club's address too, so signing in once works for all your clubs.
 */
export function sessionCookie(host: string, secure: boolean) {
  const root = rootDomain().replace(/:\d+$/, "");
  const h = host.toLowerCase().replace(/:\d+$/, "");
  const shared = root && !/^localhost$/.test(root) && (h === root || h.endsWith(`.${root}`));
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
    ...(shared ? { domain: `.${root}` } : {}),
  };
}

export function setSessionCookie(res: NextResponse, token: string, req: { headers: Headers; nextUrl: URL }) {
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(SESSION_COOKIE, token, sessionCookie(req.headers.get("host") ?? "", secure));
}

export function clearSessionCookie(res: NextResponse, req: { headers: Headers; nextUrl: URL }) {
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookie(req.headers.get("host") ?? "", secure), maxAge: 0 });
}

/** The signed-in account for this request, if any. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const id = await sessionUserId(token).catch(() => null);
  return id ? getUser(id) : null;
}

/** Sign this device out. */
export async function endSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!token) return;
  const hash = await hashToken(token);
  const userId = await sessionUserId(token).catch(() => null);
  await kvCall(["DEL", sessionKey(hash)]);
  if (userId) await kvCall(["SREM", userSessionsKey(userId), hash]);
}

/** Delete an account: every session, its record, and (through `leaveClub`) its place in each club. */
export async function deleteUser(user: User, leaveClub: (tenant: string, userId: string) => Promise<void>): Promise<void> {
  const [sessions, clubs] = await Promise.all([
    kvCall<string[]>(["SMEMBERS", userSessionsKey(user.id)]),
    kvCall<string[]>(["SMEMBERS", userClubsKey(user.id)]),
  ]);
  for (const tenant of clubs ?? []) await leaveClub(tenant, user.id);
  const keys = (sessions ?? []).map(sessionKey);
  if (keys.length) await kvCall(["DEL", ...keys]);
  await kvCall(["DEL", userKey(user.id), userSessionsKey(user.id), userClubsKey(user.id)]);
  await kvCall(["HDEL", USERS_BY_EMAIL, user.email]);
}

/** The address this request came to, for links in emails. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (/^localhost|127\.0\.0\.1/.test(host) ? "http" : "https");
  return `${proto.split(",")[0]}://${host}`;
}
