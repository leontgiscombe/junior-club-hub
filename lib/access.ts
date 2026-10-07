// Who can open a club's hub. Each club has a join code (e.g. K7Q-M3X) that
// parents type on the platform's site to find it; and a club can make its hub
// private, so only phones a coach has approved can open it. A phone that asks
// to join gets a random token in a cookie; the club keeps only the token's
// SHA-256, with the person's name and whether a coach has approved them.
//
// No server-only imports, so the proxy (which lets members in) can use it too.
import { CLUB } from "@/club.config";
import { kvCredentials } from "./kvCreds";
import { DEFAULT_TENANT } from "./tenantHost";

export const MEMBER_COOKIE = "gch_member";
/** The request's path, as the proxy passes it on to the pages. */
export const PATH_HEADER = "x-hub-path";
export const MEMBER_COOKIE_MAX_AGE = 400 * 24 * 3600;

/** Signed-in people's session cookie (lib/auth.ts). */
export const SESSION_COOKIE = "gch_session";
/** What the coach screens send in place of the coach password when someone's signed in with an account. */
export const SESSION_KEY = "~account";

/** A person's roles at a club. Club admins and coaches can use Coach Admin. */
export const ROLES = {
  admin: "Club admin",
  coach: "Coach",
  treasurer: "Treasurer",
  parent: "Parent",
  player: "Player",
} as const;
export type Role = keyof typeof ROLES;
export const COACH_ROLES: Role[] = ["admin", "coach"];

/** Someone with an account, at one club: who they are, their roles, and whether they're approved. */
export type Person = {
  userId: string;
  name: string;
  email: string;
  roles: Role[];
  status: MemberStatus;
  relation?: Relation;
  team?: { slug: string; name: string };
  child?: string;
  note?: string;
  createdAt: string;
  decidedAt?: string;
};

export type Access = { private: boolean; code: string | null };
export type MemberStatus = "pending" | "approved" | "declined";
/** Who's asking to join, as they say on the join page. */
export const RELATIONS = {
  parent: "Parent or carer",
  player: "Player",
  coach: "Coach or volunteer",
  other: "Other",
} as const;
export type Relation = keyof typeof RELATIONS;

export type Member = {
  id: string;
  name: string;
  note?: string;
  relation?: Relation;
  /** the team they're with (its name as it was when they asked) */
  team?: { slug: string; name: string };
  /** a parent's own child, as they typed it — only coaches see it */
  child?: string;
  role: "member" | "coach";
  status: MemberStatus;
  createdAt: string;
  decidedAt?: string;
};

const prefix = (tenant: string) => `${tenant === DEFAULT_TENANT ? "" : `t:${tenant}:`}${CLUB.storagePrefix}`;
export const accessKey = (tenant: string) => `${prefix(tenant)}:settings:access`;
export const membersKey = (tenant: string) => `${prefix(tenant)}:members`;
export const peopleKey = (tenant: string) => `${prefix(tenant)}:people`;
export const sessionKey = (hash: string) => `platform:session:${hash}`;
export const JOIN_CODES_KEY = "platform:join-codes";

// join codes: 6 characters, without ones that look alike (0/O, 1/I/L)
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newJoinCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}
/** A code as people type it ("k7q m3x", "K7Q-M3X") → "K7QM3X". */
export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** A code as it's shown: "K7Q-M3X". */
export const showCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function kvCall<T = unknown>(cmd: (string | number)[]): Promise<T> {
  const creds = kvCredentials();
  if (!creds) throw new Error("Storage isn't set up");
  const res = await fetch(creds.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`database ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

const parse = <T,>(v: unknown): T | null => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

export async function readAccess(tenant: string): Promise<Access> {
  const a = parse<Partial<Access>>(await kvCall(["GET", accessKey(tenant)]));
  return { private: a?.private === true, code: typeof a?.code === "string" ? a.code : null };
}

export async function readMember(tenant: string, token: string): Promise<Member | null> {
  if (!token) return null;
  return parse<Member>(await kvCall(["HGET", membersKey(tenant), await hashToken(token)]));
}

// The proxy asks on every request, so answers are remembered briefly.
const accessCache = new Map<string, { at: number; access: Access }>();
const memberCache = new Map<string, { at: number }>();

export async function cachedAccess(tenant: string): Promise<Access> {
  const hit = accessCache.get(tenant);
  if (hit && Date.now() - hit.at < 30_000) return hit.access;
  const access = await readAccess(tenant);
  accessCache.set(tenant, { at: Date.now(), access });
  return access;
}

/** Whether `token` belongs to a phone a coach has approved for `tenant`. */
export async function isApprovedMember(tenant: string, token: string): Promise<boolean> {
  if (!token) return false;
  const k = `${tenant}:${token}`;
  const hit = memberCache.get(k);
  // approvals are remembered for a minute; anything else is asked every time,
  // so a phone gets in the moment a coach approves it
  if (hit && Date.now() - hit.at < 60_000) return true;
  const ok = (await readMember(tenant, token))?.status === "approved";
  if (memberCache.size > 5000) memberCache.clear();
  if (ok) memberCache.set(k, { at: Date.now() });
  else memberCache.delete(k);
  return ok;
}

/** The account a session cookie belongs to, if it's still signed in. */
export async function sessionUserId(token: string): Promise<string | null> {
  if (!token) return null;
  const s = parse<{ userId?: string }>(await kvCall(["GET", sessionKey(await hashToken(token))]));
  return typeof s?.userId === "string" ? s.userId : null;
}

export async function readPerson(tenant: string, userId: string): Promise<Person | null> {
  return parse<Person>(await kvCall(["HGET", peopleKey(tenant), userId]));
}

const personCache = new Map<string, { at: number }>();

/** Whether a signed-in person is an approved member of `tenant` (approvals remembered for a minute). */
export async function isApprovedPerson(tenant: string, sessionToken: string): Promise<boolean> {
  if (!sessionToken) return false;
  const k = `${tenant}:${sessionToken}`;
  const hit = personCache.get(k);
  if (hit && Date.now() - hit.at < 60_000) return true;
  const userId = await sessionUserId(sessionToken);
  const ok = !!userId && (await readPerson(tenant, userId))?.status === "approved";
  if (personCache.size > 5000) personCache.clear();
  if (ok) personCache.set(k, { at: Date.now() });
  else personCache.delete(k);
  return ok;
}
