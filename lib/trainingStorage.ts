// Storage for the training log: each team trains on its own days of the week
// (Coach Admin → Settings → Teams; Mondays until they're set), and each
// session can name a best trainer. Kept in the one shared KV store as a Redis
// hash keyed by "<team>:<date>" (same pattern as the match log).
//
// The sessions themselves aren't entered by hand — they come from the schedule
// below, so the whole season's sessions are there from the start. Only what
// happens at one (its best trainer, or that it was called off) is stored.
//
// The best trainer writes through to the season tallies in lib/statsStorage.ts,
// the same way the match log's awards do, so the stats tracker, CSV and
// presentation all read one set of totals.
import { adjustPlayerStat } from "./statsStorage";
import { getTeams } from "./settings";
import { trainingOn, type Team, type TrainingSlot } from "./clubSettings";
import { getKv } from "./kv";

// Each team trains on its days from the start of the season to the end of
// July. Move these when the next season's dates are known.
export const TRAINING_START = "2026-08-17";
export const TRAINING_END = "2027-07-31";

export interface TrainingSession {
  team: string; // team slug (see lib/teams.ts)
  date: string; // YYYY-MM-DD
  bestTrainerId: string; // "" when not awarded
  // Called off (a bank holiday, the pitch is frozen) — no award to give.
  cancelled: boolean;
  // The session's times from the team's schedule, "HH:MM" (not stored: they
  // follow the schedule, so changing a team's times changes every session).
  start?: string;
  end?: string;
}


const KEY = "training";

function keyFor(team: string, date: string) {
  return `${team}:${date}`;
}

function parse(value: unknown): TrainingSession {
  const s =
    typeof value === "string"
      ? (JSON.parse(value) as TrainingSession)
      : (value as TrainingSession);
  return {
    team: s.team,
    date: s.date,
    bestTrainerId: s.bestTrainerId ?? "",
    cancelled: s.cancelled ?? false,
  };
}

/** A team's sessions from TRAINING_START to TRAINING_END, in date order, each with its slot. */
export function trainingDates(team?: Pick<Team, "training" | "trainingHistory">): { date: string; slot: TrainingSlot }[] {
  const out: { date: string; slot: TrainingSlot }[] = [];
  const day = new Date(`${TRAINING_START}T00:00:00Z`);
  const end = new Date(`${TRAINING_END}T00:00:00Z`);
  for (; day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    // the days the team had then (a change of days applies from the day it was made)
    const slot = trainingOn(team, date).find((s) => s.day === day.getUTCDay());
    if (slot) out.push({ date, slot });
  }
  return out;
}

/** Whether `team` (a slug) trains on `date` — or has a session recorded then, from before its days changed. */
export async function isTrainingDate(team: string, date: string): Promise<boolean> {
  const found = (await getTeams()).find((t) => t.slug === team);
  if (!found) return false;
  if (trainingDates(found).some((d) => d.date === date)) return true;
  const kv = await getKv();
  return !!kv && (await kv.hget<unknown>(KEY, keyFor(team, date))) != null;
}

/** Only the sessions something has been recorded against. */
async function listStored(): Promise<TrainingSession[]> {
  const kv = await getKv();
  if (!kv) return [];
  const all = await kv.hgetall<Record<string, unknown>>(KEY);
  if (!all) return [];
  return Object.values(all).map(parse);
}

/**
 * Every team's sessions across the schedule, with whatever has been recorded
 * against each — plus anything recorded on a date the schedule no longer
 * covers, so moving the dates never hides an award that was given.
 */
export async function listTraining(): Promise<TrainingSession[]> {
  const stored = new Map(
    (await listStored()).map((s) => [keyFor(s.team, s.date), s])
  );
  const sessions: TrainingSession[] = [];
  for (const team of await getTeams()) {
    for (const { date, slot } of trainingDates(team)) {
      const key = keyFor(team.slug, date);
      const session = stored.get(key) ?? { team: team.slug, date, bestTrainerId: "", cancelled: false };
      if (slot.start) session.start = slot.start;
      if (slot.end) session.end = slot.end;
      sessions.push(session);
      stored.delete(key);
    }
  }
  return [...sessions, ...stored.values()];
}

async function read(team: string, date: string): Promise<TrainingSession> {
  const kv = await getKv();
  const value = kv ? await kv.hget<unknown>(KEY, keyFor(team, date)) : null;
  return value == null
    ? { team, date, bestTrainerId: "", cancelled: false }
    : parse(value);
}

/** What's kept of a session: not its times, which come from the schedule. */
const stored = ({ team, date, bestTrainerId, cancelled }: TrainingSession) => ({ team, date, bestTrainerId, cancelled });

async function write(session: TrainingSession): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.hset(KEY, { [keyFor(session.team, session.date)]: JSON.stringify(stored(session)) });
}

/**
 * Award (or clear, with "") a session's best trainer. The previous holder
 * loses their tally and the new one gains it, so the season totals always
 * match who is shown against each session.
 */
export async function setBestTrainer(
  team: string,
  date: string,
  playerId: string
): Promise<TrainingSession> {
  const session = await read(team, date);
  if (session.bestTrainerId === playerId) return session;
  if (session.bestTrainerId) {
    await adjustPlayerStat(session.bestTrainerId, "bestTrainer", -1);
  }
  if (playerId) await adjustPlayerStat(playerId, "bestTrainer", 1);
  session.bestTrainerId = playerId;
  // Naming a best trainer means the session went ahead.
  if (playerId) session.cancelled = false;
  await write(session);
  return session;
}

/**
 * Mark a session as called off, or back on. Calling one off takes back its
 * best trainer, since nobody trained.
 */
export async function setCancelled(
  team: string,
  date: string,
  cancelled: boolean
): Promise<TrainingSession> {
  const session = await read(team, date);
  if (cancelled && session.bestTrainerId) {
    await adjustPlayerStat(session.bestTrainerId, "bestTrainer", -1);
    session.bestTrainerId = "";
  }
  session.cancelled = cancelled;
  await write(session);
  return session;
}

/** The recorded sessions, for the season archive. */
export async function listRecordedTraining(): Promise<TrainingSession[]> {
  return listStored();
}

/** Write a batch of sessions in one go (used when restoring a season). */
export async function writeTraining(sessions: TrainingSession[]): Promise<void> {
  const kv = await getKv();
  if (!kv || sessions.length === 0) return;
  const batch: Record<string, string> = {};
  for (const s of sessions) batch[keyFor(s.team, s.date)] = JSON.stringify(stored(s));
  await kv.hset(KEY, batch);
}

/** Empty the training log — the season archive keeps what it removes. */
export async function clearTraining(): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.del(KEY);
}
