// Kit asked for during the season — a new shirt, a rain jacket — by a signed-in
// parent or player, for their coaches to sort out (Kit Responses). Kept in the
// club's store as a hash of id -> request. Server only.
import { getKv } from "./kv";
import type { KitItem } from "./kitItems";
import { childrenOf, type Person } from "./access";

export interface KitRequest {
  id: string;
  team: string; // team slug
  childName: string;
  item: KitItem;
  size: string;
  quantity: number;
  note?: string;
  /** who asked: their account, and their name as the club knows them */
  userId: string;
  requestedBy: string;
  createdAt: string;
  /** when a coach marked it sorted */
  doneAt?: string;
}

const KEY = "kit_requests";
/** a family can't have more than this many waiting at once */
export const MAX_OPEN_PER_PERSON = 20;

export async function listKitRequests(): Promise<KitRequest[]> {
  const kv = await getKv();
  if (!kv) return [];
  const all = await kv.hgetall<Record<string, unknown>>(KEY);
  if (!all) return [];
  return Object.values(all)
    .map((v) => (typeof v === "string" ? (JSON.parse(v) as KitRequest) : (v as KitRequest)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addKitRequest(data: Omit<KitRequest, "id" | "createdAt">): Promise<KitRequest> {
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  const request: KitRequest = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await kv.hset(KEY, { [request.id]: JSON.stringify(request) });
  return request;
}

async function find(id: string): Promise<KitRequest | null> {
  return (await listKitRequests()).find((r) => r.id === id) ?? null;
}

/** Mark a request sorted (or not). */
export async function setKitRequestDone(id: string, done: boolean): Promise<KitRequest | null> {
  const kv = await getKv();
  const request = await find(id);
  if (!kv || !request) return null;
  if (done) request.doneAt = new Date().toISOString();
  else delete request.doneAt;
  await kv.hset(KEY, { [id]: JSON.stringify(request) });
  return request;
}

/** Remove a request; with `userId`, only if it's theirs and still waiting (a family taking theirs back). */
export async function deleteKitRequest(id: string, userId?: string): Promise<boolean> {
  const kv = await getKv();
  const request = await find(id);
  if (!kv || !request) return false;
  if (userId && (request.userId !== userId || request.doneAt)) return false;
  await kv.hdel(KEY, id);
  return true;
}

/** Who a signed-in person can ask for kit for: their children with a team, or themselves (a player). */
export function kitFamily(person: Person): { id: string; name: string; team: string }[] {
  const kids = childrenOf(person);
  if (kids.length) return kids.flatMap((k) => (k.team ? [{ id: k.id, name: k.name, team: k.team.slug }] : []));
  return person.team ? [{ id: "me", name: person.name, team: person.team.slug }] : [];
}
