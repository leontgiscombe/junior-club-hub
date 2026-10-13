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
//   platform:email-change:<id>      a new email address waiting for its code (15 minutes)
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { SESSION_COOKIE, kvCall, sessionKey, hashToken, sessionUserId } from "./access";
import { forgetPasskeys } from "./passkeys";
import { rootDomain } from "./tenantHost";

export type User = { id: string; email: string; name: string; phone?: string; createdAt: string };

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

// Changing an account's email: a code sent to the new address proves it's
// theirs (it's how they'll sign in from then on), for 15 minutes, 5 tries.
const emailChangeKey = (id: string) => `platform:email-change:${id}`;
type EmailChange = { email: string; codeHash: string; tries: number };

/** A code to email to `email`, or why it can't be their new address. */
export async function startEmailChange(user: User, email: string): Promise<{ code: string } | { error: string }> {
  if (!EMAIL.test(email)) return { error: "Enter a valid email address" };
  if (email === user.email) return { error: "That's already your email address" };
  if (await userByEmail(email)) return { error: "That email address already has an account" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const change: EmailChange = { email, codeHash: sha(`${user.id}:${email}:${code}`), tries: 0 };
  await kvCall(["SET", emailChangeKey(user.id), JSON.stringify(change), "EX", LOGIN_SECONDS]);
  return { code };
}

/** The new address, once its code is right: the account moves to it. */
export async function finishEmailChange(user: User, code: string): Promise<{ user: User; from: string } | { error: string }> {
  const change = parse<EmailChange>(await kvCall(["GET", emailChangeKey(user.id)]));
  if (!change) return { error: "That code has run out — ask for a new one" };
  if (!same(sha(`${user.id}:${change.email}:${code.replace(/\D/g, "")}`), change.codeHash)) {
    if (change.tries + 1 >= MAX_CODE_TRIES) await kvCall(["DEL", emailChangeKey(user.id)]);
    else await kvCall(["SET", emailChangeKey(user.id), JSON.stringify({ ...change, tries: change.tries + 1 }), "KEEPTTL"]);
    return { error: "That code isn't right — check the email and try again" };
  }
  await kvCall(["DEL", emailChangeKey(user.id)]);
  // the new address is theirs only if nobody's made an account with it meanwhile
  if ((await kvCall<number>(["HSETNX", USERS_BY_EMAIL, change.email, user.id])) !== 1) {
    const owner = await kvCall<string | null>(["HGET", USERS_BY_EMAIL, change.email]);
    if (owner !== user.id) return { error: "That email address already has an account" };
  }
  const fresh = (await getUser(user.id)) ?? user;
  const next: User = { ...fresh, email: change.email };
  await kvCall(["SET", userKey(user.id), JSON.stringify(next)]);
  await kvCall(["HDEL", USERS_BY_EMAIL, fresh.email]);
  return { user: next, from: fresh.email };
}

/** Their mobile number ("" takes it off). */
export async function setUserPhone(id: string, phone: string): Promise<User | null> {
  const user = await getUser(id);
  if (!user) return null;
  const next: User = { ...user, phone };
  if (!phone) delete next.phone;
  await kvCall(["SET", userKey(id), JSON.stringify(next)]);
  return next;
}

export async function setUserName(id: string, name: string): Promise<User | null> {
  const user = await getUser(id);
  if (!user) return null;
  const next = { ...user, name: name.trim().slice(0, 60) };
  await kvCall(["SET", userKey(id), JSON.stringify(next)]);
  return next;
}

/**
 * Apple's App Review signs in with accounts it can't get emails for: each
 * address in REVIEW_EMAIL (comma-separated, e.g. a club admin and a parent)
 * always gets the fixed code REVIEW_CODE (6 digits), and no email is sent.
 * Both unset (the default), there are no such accounts.
 */
export function isReviewAccount(email: string): boolean {
  const review = (process.env.REVIEW_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return review.includes(email) && /^\d{6}$/.test(reviewCode());
}
const reviewCode = () => (process.env.REVIEW_CODE ?? "").trim();

/**
 * Start signing in: a link (for this site) and a 6-digit code, both good for
 * 15 minutes, to email to `email`. The link holds a secret; the code is tried
 * at most 5 times.
 */
export async function startLogin(email: string, next: string): Promise<{ loginId: string; token: string; code: string }> {
  const loginId = randomBytes(9).toString("base64url");
  const token = randomBytes(24).toString("base64url");
  const code = isReviewAccount(email) ? reviewCode() : String(randomInt(0, 1_000_000)).padStart(6, "0");
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

/**
 * A marker that this browser's person has a passkey (no secret in it — the
 * page can read it), so sign-in offers the passkey first here, and doesn't
 * nag them to add one. Shared across the platform's addresses like the session.
 */
export const PASSKEY_HINT_COOKIE = "gch_pk";

export function setPasskeyHint(res: NextResponse, req: { headers: Headers; nextUrl: URL }, on: boolean) {
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const opts = { ...sessionCookie(req.headers.get("host") ?? "", secure), httpOnly: false, maxAge: on ? 400 * 86400 : 0 };
  res.cookies.set(PASSKEY_HINT_COOKIE, on ? "1" : "", opts);
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

/** Delete an account: every session, its passkeys, its record, and (through `leaveClub`) its place in each club. */
export async function deleteUser(user: User, leaveClub: (tenant: string, userId: string) => Promise<void>): Promise<void> {
  const [sessions, clubs] = await Promise.all([
    kvCall<string[]>(["SMEMBERS", userSessionsKey(user.id)]),
    kvCall<string[]>(["SMEMBERS", userClubsKey(user.id)]),
  ]);
  for (const tenant of clubs ?? []) await leaveClub(tenant, user.id);
  await forgetPasskeys(user.id);
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
