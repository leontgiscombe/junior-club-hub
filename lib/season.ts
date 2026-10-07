// Seasons: which one is running, and archiving a finished one.
//
// An archive holds everything that made up a season — the squads with their
// tallies, the match log AND the training log — so a past season can be presented, exported or
// restored in full, and a new season starts genuinely empty.
//
// This lives apart from statsStorage/matchStorage because it works across both
// (matchStorage already depends on statsStorage, so the orchestration cannot
// sit in either without a cycle).
import {
  listPlayers,
  writePlayers,
  STAT_FIELDS,
  type Player,
} from "./statsStorage";
import { clearMatches, listMatches, writeMatches, type Match } from "./matchStorage";
import {
  clearTraining,
  listRecordedTraining,
  writeTraining,
  type TrainingSession,
} from "./trainingStorage";
import { getKv } from "./kv";

export interface ArchivedSeason {
  id: string;
  name: string;
  archivedAt: string;
  players: Player[];
  matches: Match[];
  training: TrainingSession[];
}

// The same without the rows, for listing archives cheaply.
export type SeasonSummary = Omit<ArchivedSeason, "players" | "matches" | "training"> & {
  playerCount: number;
  matchCount: number;
};


const SEASONS_KEY = "stats_seasons";
const CURRENT_SEASON_KEY = "stats_season_current";

function parseArchive(value: unknown): ArchivedSeason {
  const a =
    typeof value === "string"
      ? (JSON.parse(value) as ArchivedSeason)
      : (value as ArchivedSeason);
  // Archives taken before the match log or training log were included hold
  // players only.
  return {
    ...a,
    players: a.players ?? [],
    matches: a.matches ?? [],
    training: a.training ?? [],
  };
}

export { defaultSeasonName } from "./seasonName";
import { defaultSeasonName } from "./seasonName";

export async function getCurrentSeason(): Promise<string> {
  const kv = await getKv();
  if (!kv) return defaultSeasonName();
  const stored = await kv.get<string>(CURRENT_SEASON_KEY);
  return typeof stored === "string" && stored.trim() ? stored : defaultSeasonName();
}

export async function setCurrentSeason(name: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.set(CURRENT_SEASON_KEY, name);
}

export async function listArchives(): Promise<SeasonSummary[]> {
  const kv = await getKv();
  if (!kv) return [];
  const all = await kv.hgetall<Record<string, unknown>>(SEASONS_KEY);
  if (!all) return [];
  return Object.values(all)
    .map(parseArchive)
    .map(({ id, name, archivedAt, players, matches }) => ({
      id,
      name,
      archivedAt,
      playerCount: players.length,
      matchCount: matches.length,
    }))
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

export async function getArchive(id: string): Promise<ArchivedSeason | null> {
  const kv = await getKv();
  if (!kv) return null;
  const value = await kv.hget<unknown>(SEASONS_KEY, id);
  return value == null ? null : parseArchive(value);
}

async function snapshot(
  name: string,
  players: Player[],
  matches: Match[],
  training: TrainingSession[]
) {
  const kv = await getKv();
  if (!kv) return null;
  const archived: ArchivedSeason = {
    id: crypto.randomUUID(),
    name,
    archivedAt: new Date().toISOString(),
    players,
    matches,
    training,
  };
  await kv.hset(SEASONS_KEY, { [archived.id]: JSON.stringify(archived) });
  return archived;
}

function zeroed(players: Player[]): Player[] {
  return players.map((player) => {
    const reset = { ...player };
    for (const field of STAT_FIELDS) reset[field] = 0;
    return reset;
  });
}

/**
 * Snapshot the season just finished — squads, tallies and every game — then
 * zero the tallies, empty the match and training logs and switch to `newSeasonName`. The
 * squads themselves are kept, so nobody has to be re-entered.
 * Returns null if there was nothing to archive.
 */
export async function archiveSeason(
  newSeasonName: string
): Promise<{ archived: ArchivedSeason; season: string } | null> {
  const kv = await getKv();
  if (!kv) return null;
  const [players, matches, training] = await Promise.all([
    listPlayers(),
    listMatches(),
    listRecordedTraining(),
  ]);
  if (players.length === 0 && matches.length === 0 && training.length === 0) {
    return null;
  }

  const archived = await snapshot(await getCurrentSeason(), players, matches, training);
  if (!archived) return null;

  await writePlayers(zeroed(players));
  await clearMatches();
  await clearTraining();
  await setCurrentSeason(newSeasonName);
  return { archived, season: newSeasonName };
}

/**
 * Put an archived season back as the live one — the undo for an accidental
 * archive. Tallies and the match and training logs are restored, the season label goes back,
 * and that archive is removed because it is live again.
 *
 * Anything recorded since is snapshotted first, so a restore can never throw
 * work away. Players added since are left in place.
 */
export async function restoreSeason(
  id: string
): Promise<{ season: string; restored: number } | null> {
  const kv = await getKv();
  if (!kv) return null;
  const archive = await getArchive(id);
  if (!archive) return null;

  const [players, matches, training] = await Promise.all([
    listPlayers(),
    listMatches(),
    listRecordedTraining(),
  ]);
  const hasWork =
    matches.length > 0 ||
    training.length > 0 ||
    players.some((p) => STAT_FIELDS.some((field) => (p[field] ?? 0) > 0));
  if (hasWork) await snapshot(await getCurrentSeason(), players, matches, training);

  if (archive.players.length > 0) await writePlayers(archive.players);
  await clearMatches();
  if (archive.matches.length > 0) await writeMatches(archive.matches);
  await clearTraining();
  await writeTraining(archive.training);

  await setCurrentSeason(archive.name);
  await kv.hdel(SEASONS_KEY, id);
  return { season: archive.name, restored: archive.players.length };
}
