// Join codes and members (lib/access.ts explains the idea): what the join page,
// Coach Admin → Members and the platform's "join your club" box do. Server only.
import { randomBytes } from "crypto";
import {
  JOIN_CODES_KEY,
  accessKey,
  hashToken,
  kvCall,
  membersKey,
  newJoinCode,
  normaliseCode,
  readAccess,
  type Access,
  type Member,
} from "./access";
import { DEFAULT_TENANT } from "./tenantHost";

async function saveAccess(tenant: string, access: Access): Promise<void> {
  await kvCall(["SET", accessKey(tenant), JSON.stringify(access)]);
}

/** A new join code, registered to `tenant` on the platform (the default club has none there). */
async function claimCode(tenant: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = newJoinCode();
    if (tenant === DEFAULT_TENANT) return code;
    if ((await kvCall<number>(["HSETNX", JOIN_CODES_KEY, code, tenant])) === 1) return code;
  }
  throw new Error("Couldn't make a join code — try again");
}

/** The club's access settings, giving it a join code if it hasn't one yet. */
export async function getAccess(tenant: string): Promise<Access & { code: string }> {
  const access = await readAccess(tenant);
  if (access.code) return access as Access & { code: string };
  const code = await claimCode(tenant);
  await saveAccess(tenant, { ...access, code });
  return { ...access, code };
}

/** Replace the club's join code; the old one stops working. */
export async function renewCode(tenant: string): Promise<string> {
  const access = await readAccess(tenant);
  const code = await claimCode(tenant);
  await saveAccess(tenant, { ...access, code });
  if (access.code && tenant !== DEFAULT_TENANT) await kvCall(["HDEL", JOIN_CODES_KEY, access.code]);
  return code;
}

/** Switch the shared coach password off (accounts only) or back on. */
export async function setPasswordOff(tenant: string, value: boolean): Promise<void> {
  const access = await getAccess(tenant);
  const next: Access = { ...access, passwordOff: value };
  if (!value) delete next.passwordOff;
  await saveAccess(tenant, next);
}

export async function setPrivate(tenant: string, value: boolean): Promise<void> {
  const access = await getAccess(tenant);
  await saveAccess(tenant, { ...access, private: value });
}

/** The club a join code is for, if any. */
export async function tenantForCode(code: string): Promise<string | null> {
  const c = normaliseCode(code);
  if (c.length !== 6) return null;
  const tenant = await kvCall<string | null>(["HGET", JOIN_CODES_KEY, c]);
  return typeof tenant === "string" ? tenant : null;
}

/** Forget a club's join code on the platform (when the club is deleted). */
export async function releaseCode(tenant: string): Promise<void> {
  const { code } = await readAccess(tenant);
  if (code) await kvCall(["HDEL", JOIN_CODES_KEY, code]);
}

/** Register a club's existing join code again (after it's restored from a backup). */
export async function reclaimCode(tenant: string): Promise<void> {
  const { code } = await readAccess(tenant);
  if (code) await kvCall(["HSETNX", JOIN_CODES_KEY, code, tenant]);
}

const newToken = () => randomBytes(32).toString("base64url");
const idFor = (hash: string) => hash.slice(0, 16);

async function save(tenant: string, hash: string, member: Member): Promise<void> {
  await kvCall(["HSET", membersKey(tenant), hash, JSON.stringify(member)]);
}

/** A phone asking to join: a new token for its cookie, and the request waiting for a coach. */
export async function requestToJoin(
  tenant: string,
  details: Pick<Member, "name" | "note" | "relation" | "team" | "child">,
): Promise<string> {
  const token = newToken();
  const hash = await hashToken(token);
  await save(tenant, hash, {
    id: idFor(hash),
    name: details.name,
    ...(details.note ? { note: details.note } : {}),
    ...(details.relation ? { relation: details.relation } : {}),
    ...(details.team ? { team: details.team } : {}),
    ...(details.child ? { child: details.child } : {}),
    role: "member",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return token;
}

/** A coach who has just signed in: their phone becomes an approved member (keeping its token if it has one). */
export async function approveCoachPhone(tenant: string, token: string | undefined): Promise<string> {
  const now = new Date().toISOString();
  if (token) {
    const hash = await hashToken(token);
    const raw = await kvCall<string | null>(["HGET", membersKey(tenant), hash]);
    if (typeof raw === "string") {
      const member = JSON.parse(raw) as Member;
      if (member.status !== "approved" || member.role !== "coach") {
        await save(tenant, hash, { ...member, role: "coach", status: "approved", decidedAt: now });
      }
      return token;
    }
  }
  const fresh = newToken();
  const hash = await hashToken(fresh);
  await save(tenant, hash, { id: idFor(hash), name: "Coach", role: "coach", status: "approved", createdAt: now, decidedAt: now });
  return fresh;
}

async function allMembers(tenant: string): Promise<[string, Member][]> {
  const flat = (await kvCall<string[]>(["HGETALL", membersKey(tenant)])) ?? [];
  const out: [string, Member][] = [];
  for (let i = 0; i < flat.length; i += 2) {
    try {
      out.push([flat[i], JSON.parse(flat[i + 1]) as Member]);
    } catch {}
  }
  return out;
}

export async function listMembers(tenant: string): Promise<Member[]> {
  return (await allMembers(tenant)).map(([, m]) => m).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A coach's decision on a member: approve, decline (they can ask again) or remove. */
export async function decide(tenant: string, id: string, action: "approve" | "decline" | "remove"): Promise<boolean> {
  const found = (await allMembers(tenant)).find(([, m]) => m.id === id);
  if (!found) return false;
  const [hash, member] = found;
  if (action === "remove") await kvCall(["HDEL", membersKey(tenant), hash]);
  else await save(tenant, hash, { ...member, status: action === "approve" ? "approved" : "declined", decidedAt: new Date().toISOString() });
  return true;
}
