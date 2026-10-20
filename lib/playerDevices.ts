// Players' own devices. Many children have their own phone or tablet: a parent
// (or a coach) makes a one-time code on the child's card, the child types it on
// their device (/player), and from then on that device is signed in as them —
// with no email or password of their own, and able to open only the Training
// Hub (proxy.ts). Parents and coaches see each child's devices and can remove
// one, which signs it out straight away. Server only.
import { randomBytes, randomInt } from "crypto";
import {
  PLAYER_COOKIE,
  PLAYER_COOKIE_MAX_AGE,
  childrenOf,
  clubKey,
  hashToken,
  kvCall,
  playerTokenKey,
  type PlayerSession,
  type Person,
} from "./access";

export const CODE_MINUTES = 10;

export type PlayerDevice = { id: string; label: string; createdAt: string; tokenHash: string; by: string };

// codes are unique across the platform, so a code says which club it's for:
// a child can type it in the app before it knows their club (/start)
const codeKey = (code: string) => `platform:player-code:${code}`;
const devicesKey = (tenant: string, playerId: string) => clubKey(tenant, `player-devices:${playerId}`);
const progressKey = (tenant: string, playerId: string) => clubKey(tenant, `player-progress:${playerId}`);

const parse = <T,>(v: unknown): T | null => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

/** Whether `person` may set up or remove `playerId`'s devices: one of the child's own approved parents or carers. */
export function isGuardianOf(person: Person | null, playerId: string): boolean {
  return !!person && person.status === "approved" && childrenOf(person).some((c) => c.playerId === playerId);
}

/** A new one-time code for `playerId`'s device: six digits, for CODE_MINUTES. */
export async function newPlayerCode(tenant: string, playerId: string, by: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const set = await kvCall(["SET", codeKey(code), JSON.stringify({ tenant, playerId, by }), "NX", "EX", CODE_MINUTES * 60]);
    if (set === "OK") return code;
  }
  throw new Error("Couldn't make a code — try again");
}

/** The club a player code is for (still unused and in time), without using it up. */
export async function playerCodeTenant(code: string): Promise<string | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return null;
  return parse<{ tenant: string }>(await kvCall(["GET", codeKey(clean)]))?.tenant ?? null;
}

/** A short name for the device, from its browser: "iPhone", "Android tablet". */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent || "";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Macintosh|Windows|Linux/.test(ua)) return "Computer";
  return "Device";
}

/**
 * Uses up `code` and signs this device in as its player: the token for the
 * cookie, or null if the code is wrong or has run out.
 */
export async function redeemPlayerCode(tenant: string, code: string, label: string): Promise<{ token: string; playerId: string } | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return null;
  const key = codeKey(clean);
  const found = parse<{ tenant: string; playerId: string; by: string }>(await kvCall(["GET", key]));
  if (!found || found.tenant !== tenant) return null;
  // once only
  if (Number(await kvCall(["DEL", key])) !== 1) return null;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = await hashToken(token);
  const device: PlayerDevice = { id: randomBytes(6).toString("base64url"), label, createdAt: new Date().toISOString(), tokenHash, by: found.by };
  const session: PlayerSession = { tenant, playerId: found.playerId, deviceId: device.id };
  await kvCall(["SET", playerTokenKey(tokenHash), JSON.stringify(session), "EX", PLAYER_COOKIE_MAX_AGE]);
  await kvCall(["HSET", devicesKey(tenant, found.playerId), device.id, JSON.stringify(device)]);
  return { token, playerId: found.playerId };
}

/** The devices set up for `playerId`, newest first (signed-out ones are tidied away). */
export async function listPlayerDevices(tenant: string, playerId: string): Promise<Omit<PlayerDevice, "tokenHash">[]> {
  const flat = (await kvCall<string[] | null>(["HGETALL", devicesKey(tenant, playerId)])) ?? [];
  const out: Omit<PlayerDevice, "tokenHash">[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const d = parse<PlayerDevice>(flat[i + 1]);
    if (!d) continue;
    // run out (a year) without anyone removing it
    if (!(await kvCall(["EXISTS", playerTokenKey(d.tokenHash)]))) {
      await kvCall(["HDEL", devicesKey(tenant, playerId), d.id]);
      continue;
    }
    out.push({ id: d.id, label: d.label, createdAt: d.createdAt, by: d.by });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Signs one of `playerId`'s devices out, there and then. */
export async function removePlayerDevice(tenant: string, playerId: string, deviceId: string): Promise<boolean> {
  const d = parse<PlayerDevice>(await kvCall(["HGET", devicesKey(tenant, playerId), deviceId]));
  if (!d) return false;
  await kvCall(["DEL", playerTokenKey(d.tokenHash)]);
  await kvCall(["HDEL", devicesKey(tenant, playerId), deviceId]);
  return true;
}

/** Every one of `playerId`'s devices signed out (they've left the squad), and their progress gone. */
export async function removeAllPlayerDevices(tenant: string, playerId: string): Promise<void> {
  const flat = (await kvCall<string[] | null>(["HGETALL", devicesKey(tenant, playerId)])) ?? [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const d = parse<PlayerDevice>(flat[i + 1]);
    if (d) await kvCall(["DEL", playerTokenKey(d.tokenHash)]);
  }
  await kvCall(["DEL", devicesKey(tenant, playerId)]);
  await kvCall(["DEL", progressKey(tenant, playerId)]);
}

/** Every player device of a club signed out (the club is being deleted). */
export async function removeClubPlayerDevices(tenant: string): Promise<void> {
  let cursor = "0";
  do {
    const [next, keys] = (await kvCall<[string | number, string[]]>(["SCAN", cursor, "MATCH", clubKey(tenant, "player-devices:*"), "COUNT", "500"])) ?? ["0", []];
    for (const key of keys) await removeAllPlayerDevices(tenant, key.slice(key.lastIndexOf(":") + 1));
    cursor = String(next);
  } while (cursor !== "0");
}

/** The cookie that keeps a player's device signed in. */
export const playerCookie = (secure: boolean) => ({
  name: PLAYER_COOKIE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: PLAYER_COOKIE_MAX_AGE,
});

/**
 * A player's Training Hub progress, kept with them rather than on one device:
 * this week's ticked challenges and their quiz bests, by format and level.
 */
export type PlayerProgress = {
  week: number;
  skills: Record<string, boolean>;
  bests: Record<string, { score: number; total: number; date: string }>;
};

export async function getProgress(tenant: string, playerId: string): Promise<PlayerProgress | null> {
  return parse<PlayerProgress>(await kvCall(["GET", progressKey(tenant, playerId)]));
}

/** Keeps only well-formed progress, of a sensible size. */
export function cleanProgress(input: unknown): PlayerProgress | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const week = Number(r.week);
  if (!Number.isInteger(week) || week < 0) return null;
  const skills: Record<string, boolean> = {};
  if (r.skills && typeof r.skills === "object") {
    for (const [k, v] of Object.entries(r.skills as Record<string, unknown>).slice(0, 100)) {
      if (/^[\w-]{1,40}$/.test(k) && v === true) skills[k] = true;
    }
  }
  const bests: PlayerProgress["bests"] = {};
  if (r.bests && typeof r.bests === "object") {
    for (const [k, v] of Object.entries(r.bests as Record<string, unknown>).slice(0, 20)) {
      const b = v as Record<string, unknown> | null;
      if (!/^[\w-]{1,40}$/.test(k) || !b) continue;
      const score = Number(b.score), total = Number(b.total);
      if (Number.isInteger(score) && Number.isInteger(total) && score >= 0 && total > 0 && score <= total && total <= 100) {
        bests[k] = { score, total, date: typeof b.date === "string" ? b.date.slice(0, 10) : "" };
      }
    }
  }
  return { week, skills, bests };
}

export async function saveProgress(tenant: string, playerId: string, progress: PlayerProgress): Promise<void> {
  await kvCall(["SET", progressKey(tenant, playerId), JSON.stringify(progress)]);
}
