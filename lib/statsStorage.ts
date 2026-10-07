// Storage for the per-team player stats tracker.
// Tracks, per player, a running season tally of appearances, goals, assists,
// clean sheets, player of the match, most improved and best trainer. Kept in the one shared
// KV store as a Redis hash keyed by player id, so a single player can be
// updated or removed without rewriting the whole list (same pattern as the
// camera register).
//
// Seasons and archiving live in lib/season.ts, which works across these
// players and the match log.

// The countable stats a player accrues over the season. Every player carries
// all of them; which ones are *shown* depends on their position — see
// lib/positions.ts.
export const STAT_FIELDS = [
  "appearances",
  "goals",
  "assists",
  "saves",
  "penaltiesSaved",
  "potm",
  "mostImproved",
  "bestTrainer",
] as const;
export type StatField = (typeof STAT_FIELDS)[number];

// A goalkeeper is judged on saves and clean sheets rather than goals and
// assists, so their card shows a different set of tallies.
export const POSITIONS = ["outfield", "goalkeeper"] as const;
export type Position = (typeof POSITIONS)[number];

export function isPosition(value: unknown): value is Position {
  return POSITIONS.includes(value as Position);
}

export interface Player {
  id: string;
  team: string; // team slug (see lib/teams.ts)
  name: string;
  position: Position;
  appearances: number;
  goals: number;
  assists: number;
  saves: number; // goalkeepers
  penaltiesSaved: number; // goalkeepers
  potm: number; // player of the match
  mostImproved: number; // most improved
  bestTrainer: number; // best trainer, from the training log
  createdAt: string;
}

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

const KEY = "player_stats";

function parse(value: unknown): Player {
  const p = typeof value === "string" ? (JSON.parse(value) as Player) : (value as Player);
  // Be tolerant of older records that predate a stat field, or positions.
  const filled = { ...p };
  for (const field of STAT_FIELDS) filled[field] = p[field] ?? 0;
  filled.position = isPosition(p.position) ? p.position : "outfield";
  return filled;
}

// Coerce to a whole number that is never negative.
function clamp(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export async function addPlayer(
  data: Pick<Player, "team" | "name"> & { position?: Position }
): Promise<{ saved: boolean; player: Player }> {
  const player: Player = {
    id: crypto.randomUUID(),
    team: data.team,
    name: data.name,
    position: isPosition(data.position) ? data.position : "outfield",
    appearances: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    penaltiesSaved: 0,
    potm: 0,
    mostImproved: 0,
    bestTrainer: 0,
    createdAt: new Date().toISOString(),
  };
  const kv = await getKv();
  if (kv) {
    await kv.hset(KEY, { [player.id]: JSON.stringify(player) });
    return { saved: true, player };
  }
  return { saved: false, player };
}

// Update a player's name, position and/or any of their stat tallies.
export async function updatePlayer(
  id: string,
  patch: Partial<Pick<Player, "name" | "position" | StatField>>
): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  const current = await kv.hget<unknown>(KEY, id);
  if (current == null) return false;
  const player = parse(current);
  if (typeof patch.name === "string" && patch.name.trim()) {
    player.name = patch.name.trim();
  }
  if (isPosition(patch.position)) player.position = patch.position;
  for (const field of STAT_FIELDS) {
    if (field in patch) player[field] = clamp(patch[field]);
  }
  await kv.hset(KEY, { [id]: JSON.stringify(player) });
  return true;
}

/**
 * Nudge one of a player's tallies by `delta`, never below zero. Used by the
 * match log so logging a goal also credits the season tally (and removing it
 * takes the credit back), keeping one set of totals across both views.
 */
export async function adjustPlayerStat(
  id: string,
  field: StatField,
  delta: number
): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  const current = await kv.hget<unknown>(KEY, id);
  if (current == null) return false;
  const player = parse(current);
  player[field] = clamp((player[field] ?? 0) + delta);
  await kv.hset(KEY, { [id]: JSON.stringify(player) });
  return true;
}

/** Write a batch of players in one go (used by the season archive). */
export async function writePlayers(players: Player[]): Promise<void> {
  const kv = await getKv();
  if (!kv || players.length === 0) return;
  const batch: Record<string, string> = {};
  for (const player of players) batch[player.id] = JSON.stringify(player);
  await kv.hset(KEY, batch);
}

export async function listPlayers(): Promise<Player[]> {
  const kv = await getKv();
  if (!kv) return [];
  const all = await kv.hgetall<Record<string, unknown>>(KEY);
  if (!all) return [];
  return Object.values(all).map(parse);
}

export async function deletePlayer(id: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.hdel(KEY, id);
}
