// Fixtures as families and coaches see them (app/fixtures): each game in the
// match log (lib/matchStorage.ts), sent to the team's families, who say for
// each of their children whether they can play; the coaches say whether they
// can host it; and the coaches pick a line-up only they can see.
//
// Answers are kept in one hash per game ("fixture_responses:<match id>"), a
// field each — "p:<player id>" for a child, "h:<account id>" for a coach — so
// two parents answering at once never overwrite each other. Server only.
import { childrenOf, COACH_ROLES, type Person } from "./access";
import { getKv } from "./kv";
import { listPlayers, type Player } from "./statsStorage";
import type { Match } from "./matchStorage";

export type Answer = "yes" | "no";

export type Reply = {
  answer: Answer;
  /** a reason given with "can't make it", for the coaches */
  note?: string;
  /** who answered (their name), and when */
  by: string;
  byUserId: string;
  at: string;
};

export type Replies = { players: Record<string, Reply>; hosts: Record<string, Reply> };

const key = (matchId: string) => `fixture_responses:${matchId}`;

function parseReply(v: unknown): Reply | null {
  try {
    const r = (typeof v === "string" ? JSON.parse(v) : v) as Reply;
    return r && (r.answer === "yes" || r.answer === "no") ? r : null;
  } catch {
    return null;
  }
}

/** Everyone's answers to a game. */
export async function readReplies(matchId: string): Promise<Replies> {
  const out: Replies = { players: {}, hosts: {} };
  const kv = await getKv();
  if (!kv) return out;
  const all = (await kv.hgetall<Record<string, unknown>>(key(matchId))) ?? {};
  for (const [field, value] of Object.entries(all)) {
    const r = parseReply(value);
    if (!r) continue;
    if (field.startsWith("p:")) out.players[field.slice(2)] = r;
    else if (field.startsWith("h:")) out.hosts[field.slice(2)] = r;
  }
  return out;
}

/** Answers to several games at once (the fixtures list). */
export async function readRepliesFor(matchIds: string[]): Promise<Record<string, Replies>> {
  const entries = await Promise.all(matchIds.map(async (id) => [id, await readReplies(id)] as const));
  return Object.fromEntries(entries);
}

/** Save (or, with null, take back) one answer: a child's ("p", their player id) or a coach's own ("h", their account id). */
export async function saveReply(matchId: string, who: { kind: "p" | "h"; id: string }, reply: Reply | null): Promise<void> {
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  const field = `${who.kind}:${who.id}`;
  if (reply) await kv.hset(key(matchId), { [field]: JSON.stringify(reply) });
  else await kv.hdel(key(matchId), field);
}

/** The team's squad, by name. */
export async function squadOf(team: string): Promise<Player[]> {
  return (await listPlayers()).filter((p) => p.team === team).sort((a, b) => a.name.localeCompare(b.name));
}

export const isCoachPerson = (p: Person) => p.status === "approved" && p.roles.some((r) => COACH_ROLES.includes(r));

/**
 * The coaches who host a team's games: its own coaches; for a team with none,
 * the coaches who look after every team and the club admins.
 */
export function hostsOf(people: Person[], team: string): Person[] {
  const coaches = people.filter(isCoachPerson);
  const own = coaches.filter((p) => p.team?.slug === team);
  return own.length ? own : coaches.filter((p) => !p.team || p.roles.includes("admin"));
}

/** The approved parents with a child in `team`'s squad. */
export function familiesOf(people: Person[], team: string): Person[] {
  return people.filter(
    (p) => p.status === "approved" && childrenOf(p).some((c) => !c.pending && c.playerId && c.team?.slug === team),
  );
}

/** `person`'s own children in `team`'s squad: the ones they answer for. */
export function myPlayersIn(person: Person | null, squad: Player[]): { playerId: string; name: string }[] {
  if (!person || person.status !== "approved") return [];
  const ids = new Set(squad.map((p) => p.id));
  return childrenOf(person)
    .filter((c) => !c.pending && c.playerId && ids.has(c.playerId))
    .map((c) => ({ playerId: c.playerId!, name: squad.find((p) => p.id === c.playerId)?.name ?? c.name }));
}

/** A line-up's positions for a shape ("2-3-1"): the keeper, then each line from the back. */
export function lineupSlots(formation: string): { label: string; line: number; index: number; of: number }[] {
  const lines = formation.split("-").map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 6);
  const names = lines.length === 4 ? ["DEF", "DM", "AM", "FWD"] : lines.length === 2 ? ["DEF", "FWD"] : ["DEF", "MID", "FWD"];
  const out = [{ label: "GK", line: 0, index: 0, of: 1 }];
  lines.forEach((n, li) => {
    for (let i = 0; i < n; i++) out.push({ label: names[li] ?? "MID", line: li + 1, index: i, of: n });
  });
  return out;
}

/** "Can play": squad players whose families said yes. */
export function tally(squad: Player[], replies: Replies) {
  let yes = 0;
  let no = 0;
  for (const p of squad) {
    const r = replies.players[p.id];
    if (r?.answer === "yes") yes++;
    else if (r?.answer === "no") no++;
  }
  return { yes, no, waiting: squad.length - yes - no };
}

/** Whether a game has finished being played: its date has passed, or a result is in. */
export function isPast(m: Pick<Match, "date" | "resultLogged">, today: string): boolean {
  return m.resultLogged || m.date < today;
}
