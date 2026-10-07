// Storage for the match log: each game a team played, and every goal in it
// with who scored and who assisted. Kept in the one shared KV store as a Redis
// hash keyed by match id (same pattern as the camera register).
//
// Goals here write through to the season tallies in lib/statsStorage.ts —
// logging a goal credits the scorer's goals and the assister's assists, and
// removing it takes that credit back. That keeps one set of totals behind the
// stats tracker, the awards, the CSV exports and the presentation, while the
// match log adds the per-game detail on top.
import { adjustPlayerStat } from "./statsStorage";
import type { FaFixture } from "./faFullTime";
import { getKv } from "./kv";

export interface GoalEvent {
  id: string;
  // "" when the scorer wasn't recorded — a goal that counts towards the score
  // without being credited to anybody, for a result logged after the event.
  scorerId: string;
  assistId: string; // "" when nobody assisted
}

export interface Match {
  id: string;
  team: string; // team slug (see lib/teams.ts)
  opponent: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h); "" when not set
  home: boolean;
  // The camera register is a view of home games: who is filming, and whether
  // the footage reached the cloud.
  cameraHolder: string; // see lib/cameraHolders.ts; "" when unset
  footageUploaded: boolean;
  // Friendlies and cup games are logged the same way but kept out of the
  // league record, so the P/W/D/L table stays a league table.
  friendly: boolean;
  // Of those, a cup game rather than a friendly. Only meaningful when friendly
  // is true; games logged before the two were split read as friendlies.
  cup: boolean;
  goals: GoalEvent[]; // our goals, in the order they were logged
  opponentGoals: number;
  // Who played — each name here counts one appearance in the season tallies.
  appearanceIds: string[];
  potmId: string; // player of the match; "" when not awarded
  mostImprovedId: string; // most improved; "" when not awarded
  // True once the score is known, so the season record only counts games that
  // were actually played and logged — a past fixture nobody has filled in is
  // not silently counted as a 0–0 draw.
  resultLogged: boolean;
  // The game's id on FA Full-Time when it came from (or was matched to) the
  // FA fixtures sync — "" for a game only ever entered by hand.
  faId: string;
  createdAt: string;
}

// The per-game awards, and the season tally each one feeds.
export const AWARD_STAT = {
  potmId: "potm",
  mostImprovedId: "mostImproved",
} as const;

export type AwardField = keyof typeof AWARD_STAT;


const KEY = "matches";

function parse(value: unknown): Match {
  const m = typeof value === "string" ? (JSON.parse(value) as Match) : (value as Match);
  // Tolerate games logged before the awards existed.
  const goals = m.goals ?? [];
  const opponentGoals = m.opponentGoals ?? 0;
  return {
    ...m,
    goals,
    opponentGoals,
    appearanceIds: m.appearanceIds ?? [],
    time: m.time ?? "",
    cameraHolder: m.cameraHolder ?? "",
    footageUploaded: m.footageUploaded ?? false,
    potmId: m.potmId ?? "",
    mostImprovedId: m.mostImprovedId ?? "",
    friendly: m.friendly ?? false,
    cup: (m.friendly ?? false) && (m.cup ?? false),
    faId: m.faId ?? "",
    // Games logged before this existed count as recorded if they have a score.
    resultLogged: m.resultLogged ?? (goals.length > 0 || opponentGoals > 0),
  };
}

function clamp(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

async function read(id: string): Promise<Match | null> {
  const kv = await getKv();
  if (!kv) return null;
  const value = await kv.hget<unknown>(KEY, id);
  return value == null ? null : parse(value);
}

async function write(match: Match): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.hset(KEY, { [match.id]: JSON.stringify(match) });
}

export async function listMatches(): Promise<Match[]> {
  const kv = await getKv();
  if (!kv) return [];
  const all = await kv.hgetall<Record<string, unknown>>(KEY);
  if (!all) return [];
  return Object.values(all).map(parse);
}

/** Write a batch of games in one go (used when restoring a season). */
export async function writeMatches(matches: Match[]): Promise<void> {
  const kv = await getKv();
  if (!kv || matches.length === 0) return;
  const batch: Record<string, string> = {};
  for (const match of matches) batch[match.id] = JSON.stringify(match);
  await kv.hset(KEY, batch);
}

/** Empty the match log — the season archive keeps the games it removes. */
export async function clearMatches(): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.del(KEY);
}

export async function addMatch(
  data: Pick<Match, "team" | "opponent" | "date" | "home" | "friendly"> &
    Partial<Pick<Match, "time" | "cameraHolder" | "footageUploaded" | "cup" | "faId">>
): Promise<{ saved: boolean; match: Match }> {
  const match: Match = {
    ...data,
    id: crypto.randomUUID(),
    time: data.time ?? "",
    cameraHolder: data.cameraHolder ?? "",
    footageUploaded: data.footageUploaded ?? false,
    cup: data.friendly && (data.cup ?? false),
    faId: data.faId ?? "",
    goals: [],
    opponentGoals: 0,
    appearanceIds: [],
    potmId: "",
    mostImprovedId: "",
    resultLogged: false,
    createdAt: new Date().toISOString(),
  };
  const kv = await getKv();
  if (kv) {
    await write(match);
    return { saved: true, match };
  }
  return { saved: false, match };
}

/** The details of a fixture, as opposed to what happened in it. */
export type MatchDetails = Pick<
  Match,
  "opponent" | "date" | "time" | "home" | "friendly" | "cup"
>;

/**
 * Change a fixture's details — opponent, date, kick-off, home or away, and
 * whether it counts towards the league. Fixtures move about through the season
 * (a cup tie displaces a league game, a kick-off shifts, a pitch is swapped),
 * and re-entering a game would take its goals off the players' totals and put
 * them back on. Nothing here touches the goals, awards or appearances already
 * logged, so the season tallies are left exactly as they are.
 *
 * Only the fields passed are changed; leave one out and it stays as it was.
 */
export async function updateMatch(
  matchId: string,
  details: Partial<MatchDetails>
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  if (typeof details.opponent === "string" && details.opponent.trim()) {
    match.opponent = details.opponent.trim();
  }
  if (typeof details.date === "string" && details.date) match.date = details.date;
  if (typeof details.time === "string") match.time = details.time;
  if (typeof details.home === "boolean") match.home = details.home;
  if (typeof details.friendly === "boolean") match.friendly = details.friendly;
  if (typeof details.cup === "boolean") match.cup = details.cup;
  // a league game is neither a friendly nor a cup game
  if (!match.friendly) match.cup = false;
  await write(match);
  return match;
}

// Credit (or, with -1, un-credit) a goal's scorer and assister. A goal with no
// scorer recorded counts towards the score but credits nobody.
async function creditGoal(goal: GoalEvent, delta: number) {
  if (goal.scorerId) await adjustPlayerStat(goal.scorerId, "goals", delta);
  if (goal.assistId) await adjustPlayerStat(goal.assistId, "assists", delta);
}

export async function addGoal(
  matchId: string,
  scorerId: string,
  assistId: string
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  const goal: GoalEvent = { id: crypto.randomUUID(), scorerId, assistId };
  match.goals.push(goal);
  // Logging the first goal of a 1–0 makes the score final.
  match.resultLogged = true;
  await write(match);
  await creditGoal(goal, 1);
  return match;
}

/**
 * Set how many goals we scored, for a result being written up afterwards when
 * nobody remembers who scored what. Goals already credited to a player are
 * left alone: the difference is made up with goals that have no scorer
 * recorded, and taking the score back down removes those first, so a scorer is
 * never quietly stripped of a goal.
 *
 * Returns "below-credited" if the score would drop below the goals already
 * credited to players — those have to be removed one by one, deliberately —
 * and null if there is no such match.
 */
export async function setOurGoals(
  matchId: string,
  ourGoals: number
): Promise<Match | "below-credited" | null> {
  const match = await read(matchId);
  if (!match) return null;
  const target = clamp(ourGoals);
  const credited = match.goals.filter((g) => g.scorerId);
  if (target < credited.length) return "below-credited";

  const unknown = match.goals.filter((g) => !g.scorerId);
  const wanted = target - credited.length;

  for (let i = unknown.length; i < wanted; i++) {
    match.goals.push({ id: crypto.randomUUID(), scorerId: "", assistId: "" });
  }
  if (unknown.length > wanted) {
    const dropping = new Set(unknown.slice(wanted).map((g) => g.id));
    match.goals = match.goals.filter((g) => !dropping.has(g.id));
  }

  match.resultLogged = true;
  await write(match);
  return match;
}

export async function removeGoal(matchId: string, goalId: string): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  const goal = match.goals.find((g) => g.id === goalId);
  if (!goal) return match;
  match.goals = match.goals.filter((g) => g.id !== goalId);
  await write(match);
  await creditGoal(goal, -1);
  return match;
}

/**
 * Award (or clear, with "") a game's player of the match or most improved.
 * The previous holder loses their tally and the new one gains it, so the
 * season totals always match who is shown against each game.
 */
export async function setAward(
  matchId: string,
  field: AwardField,
  playerId: string
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  const previous = match[field] ?? "";
  if (previous === playerId) return match;

  const stat = AWARD_STAT[field];
  if (previous) await adjustPlayerStat(previous, stat, -1);
  if (playerId) await adjustPlayerStat(playerId, stat, 1);

  match[field] = playerId;
  await write(match);
  return match;
}

export async function setOpponentGoals(
  matchId: string,
  opponentGoals: number
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  match.opponentGoals = clamp(opponentGoals);
  match.resultLogged = true;
  await write(match);
  return match;
}

/**
 * Set exactly who played in a game. Players added since last time gain an
 * appearance and players dropped lose one, so the season tallies always match
 * the names ticked against each game.
 */
export async function setAppearances(
  matchId: string,
  playerIds: string[]
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  const before = new Set(match.appearanceIds ?? []);
  const after = new Set(playerIds);

  for (const id of before) {
    if (!after.has(id)) await adjustPlayerStat(id, "appearances", -1);
  }
  for (const id of after) {
    if (!before.has(id)) await adjustPlayerStat(id, "appearances", 1);
  }

  match.appearanceIds = [...after];
  await write(match);
  return match;
}

/** Who is filming a home game (see lib/cameraHolders.ts); "" clears it. */
export async function setCameraHolder(
  matchId: string,
  holder: string
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  match.cameraHolder = holder;
  await write(match);
  return match;
}

/** Whether a home game's footage has reached the cloud. */
export async function setFootageUploaded(
  matchId: string,
  uploaded: boolean
): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  match.footageUploaded = uploaded;
  await write(match);
  return match;
}

/** Mark a game's score as final — used to confirm a genuine 0–0. */
export async function confirmResult(matchId: string): Promise<Match | null> {
  const match = await read(matchId);
  if (!match) return null;
  match.resultLogged = true;
  await write(match);
  return match;
}

// Deleting a match takes back everything it credited — goals, assists, the
// per-game awards and appearances.
export async function deleteMatch(id: string): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  const match = await read(id);
  if (!match) return false;
  for (const goal of match.goals) await creditGoal(goal, -1);
  for (const field of Object.keys(AWARD_STAT) as AwardField[]) {
    if (match[field]) await adjustPlayerStat(match[field], AWARD_STAT[field], -1);
  }
  for (const id of match.appearanceIds ?? []) {
    await adjustPlayerStat(id, "appearances", -1);
  }
  await kv.hdel(KEY, id);
  return true;
}

/**
 * Bring a team's fixtures in line with FA Full-Time (see lib/faFullTime.ts).
 * A game already linked to a Full-Time fixture has its date, kick-off, venue
 * (home/away), opponent and league/cup updated; a game entered by hand on the
 * same day against the same side is linked to it; anything else is added.
 * Goals, awards, appearances and filming are never touched, and nothing is
 * deleted — a game Full-Time no longer lists is left for a coach to sort out.
 */
export async function syncFaFixtures(
  team: string,
  fixtures: FaFixture[]
): Promise<{ added: number; updated: number; matches: Match[] }> {
  const all = await listMatches();
  const ours = all.filter((m) => m.team === team);
  let added = 0;
  let updated = 0;
  for (const f of fixtures) {
    const details = {
      date: f.date,
      time: f.time,
      home: f.home,
      opponent: f.opponent,
      friendly: f.cup,
      cup: f.cup,
    };
    const existing =
      ours.find((m) => m.faId === f.faId) ??
      ours.find((m) => !m.faId && m.date === f.date && m.opponent === f.opponent) ??
      (() => {
        // one unlinked game that day — the same fixture, entered by hand
        const sameDay = ours.filter((m) => !m.faId && m.date === f.date);
        return sameDay.length === 1 ? sameDay[0] : undefined;
      })();
    if (existing) {
      const changed =
        existing.faId !== f.faId ||
        (Object.keys(details) as (keyof typeof details)[]).some(
          (k) => existing[k] !== details[k]
        );
      if (!changed) continue;
      Object.assign(existing, details, { faId: f.faId });
      await write(existing);
      updated++;
    } else {
      const { match } = await addMatch({ team, ...details, faId: f.faId });
      ours.push(match);
      all.push(match);
      added++;
    }
  }
  return { added, updated, matches: all };
}
