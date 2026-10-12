// A parent who's taken a child off their account (Your Account → Your
// Children): noted on the player, so a coach sees it in Members (the child may
// have left the club) until they dismiss it, or that parent links them again.
// Server only.
import { clubKey, kvCall } from "./access";

export type ChildRemoval = { userId: string; by: string; at: string };

const removalsKey = (tenant: string) => clubKey(tenant, "child-removals");

export async function recordRemoval(tenant: string, playerId: string, removal: ChildRemoval): Promise<void> {
  await kvCall(["HSET", removalsKey(tenant), playerId, JSON.stringify(removal)]);
}

export async function listRemovals(tenant: string): Promise<Record<string, ChildRemoval>> {
  const flat = (await kvCall<string[] | null>(["HGETALL", removalsKey(tenant)])) ?? [];
  const out: Record<string, ChildRemoval> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try {
      out[flat[i]] = JSON.parse(flat[i + 1]) as ChildRemoval;
    } catch {}
  }
  return out;
}

export async function clearRemoval(tenant: string, playerId: string): Promise<void> {
  await kvCall(["HDEL", removalsKey(tenant), playerId]);
}
