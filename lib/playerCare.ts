// A squad player's medical notes and emergency contact: kept apart from the
// squad's stats (which every member can see), for the child's own parents and
// carers and the club's coaches only (app/api/players/care). Server only.
import { clubKey, kvCall } from "./access";

export type PlayerCare = { medical: string; emergency: string; updatedAt?: string; by?: string };

const careKey = (tenant: string) => clubKey(tenant, "player-care");

export const MEDICAL_MAX = 500;
export const EMERGENCY_MAX = 120;

export async function getCare(tenant: string, playerId: string): Promise<PlayerCare> {
  const raw = await kvCall<string | null>(["HGET", careKey(tenant), playerId]);
  try {
    const c = raw ? (JSON.parse(raw) as Partial<PlayerCare>) : {};
    return { medical: c.medical ?? "", emergency: c.emergency ?? "", ...(c.updatedAt ? { updatedAt: c.updatedAt, by: c.by } : {}) };
  } catch {
    return { medical: "", emergency: "" };
  }
}

export async function saveCare(tenant: string, playerId: string, care: { medical: string; emergency: string }, by: string): Promise<PlayerCare> {
  const medical = care.medical.trim().slice(0, MEDICAL_MAX);
  const emergency = care.emergency.trim().slice(0, EMERGENCY_MAX);
  if (!medical && !emergency) {
    await removeCare(tenant, playerId);
    return { medical, emergency };
  }
  const saved: PlayerCare = { medical, emergency, updatedAt: new Date().toISOString(), by };
  await kvCall(["HSET", careKey(tenant), playerId, JSON.stringify(saved)]);
  return saved;
}

/** Gone with the player, when they leave the squad. */
export async function removeCare(tenant: string, playerId: string): Promise<void> {
  await kvCall(["HDEL", careKey(tenant), playerId]);
}
