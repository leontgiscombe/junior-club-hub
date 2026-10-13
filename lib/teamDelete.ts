// Deleting a team for good (Settings → Teams → an archived team → Delete for
// Good): its games, training sessions and plan, its squad players (with their
// photos, medical notes and devices, and off their parents' lists), its kit
// sizes and requests, and its Finances records; anyone whose own team it was
// keeps their place in the club without it. Only an archived team, and only
// once its name is typed (app/api/teams/delete). Server only.
import { childrenOf, kvCall, peopleKey, type Person } from "./access";
import { financeKeys } from "./financeStorage";
import { getKv } from "./kv";
import { listPeople } from "./people";
import { removeAllPlayerDevices } from "./playerDevices";
import { removeCare } from "./playerCare";
import { clearRemoval } from "./childRemovals";
import { deletePlayerPhoto } from "./playerPhoto";
import { getAllTeamsFor, saveTeams } from "./settings";

export type TeamFootprint = { games: number; sessions: number; players: number; kitSizes: number; kitRequests: number; finances: boolean; plan: boolean };

const parse = <T,>(v: unknown): T | null => {
  try {
    return (typeof v === "string" ? JSON.parse(v) : v) as T;
  } catch {
    return null;
  }
};

async function gather(tenant: string, team: string) {
  const kv = await getKv(tenant);
  if (!kv) throw new Error("Storage isn't set up");
  const [matches, training, players, requests, plans] = await Promise.all([
    kv.hgetall<Record<string, unknown>>("matches"),
    kv.hgetall<Record<string, unknown>>("training"),
    kv.hgetall<Record<string, unknown>>("player_stats"),
    kv.hgetall<Record<string, unknown>>("kit_requests"),
    kv.hgetall<Record<string, unknown>>("training_plans"),
  ]);
  const of = (all: Record<string, unknown> | null, match: (v: { team?: string }, key: string) => boolean) =>
    Object.entries(all ?? {}).filter(([k, v]) => match(parse<{ team?: string }>(v) ?? {}, k)).map(([k]) => k);
  return {
    kv,
    games: of(matches, (v) => v.team === team),
    sessions: of(training, (v, k) => v.team === team || k.startsWith(`${team}:`)),
    players: of(players, (v) => v.team === team),
    requests: of(requests, (v) => v.team === team),
    plan: !!plans && team in plans,
    kitSizes: ((await kv.lrange<string>(`kit_submissions:${team}`, 0, -1).catch(() => [])) ?? []).length,
    finances: Number(await kvCall<number>(["EXISTS", financeKeys(tenant).auth(team), financeKeys(tenant).data(team)]).catch(() => 0)) > 0,
  };
}

/** What deleting `team` would delete. */
export async function teamFootprint(tenant: string, team: string): Promise<TeamFootprint> {
  const g = await gather(tenant, team);
  return { games: g.games.length, sessions: g.sessions.length, players: g.players.length, kitSizes: g.kitSizes, kitRequests: g.requests.length, finances: g.finances, plan: g.plan };
}

/** Delete an archived team and everything that's only its. */
export async function deleteTeamForGood(tenant: string, team: string): Promise<void> {
  const teams = await getAllTeamsFor(tenant);
  const t = teams.find((x) => x.slug === team);
  if (!t) throw new Error("No such team");
  if (!t.archived) throw new Error("Archive the team first");
  const g = await gather(tenant, team);
  const fk = financeKeys(tenant);
  const gone = new Set(g.players);
  // everything at once, rather than one round trip after another
  await Promise.all([
    g.games.length ? g.kv.hdel("matches", ...g.games) : null,
    g.sessions.length ? g.kv.hdel("training", ...g.sessions) : null,
    g.requests.length ? g.kv.hdel("kit_requests", ...g.requests) : null,
    g.plan ? g.kv.hdel("training_plans", team) : null,
    g.kv.del(`kit_submissions:${team}`),
    kvCall(["DEL", fk.data(team), fk.auth(team), fk.devices(team), fk.escrow(team)]),
    // the squad players, and what's only theirs: photos, devices, medical notes
    g.players.length ? g.kv.hdel("player_stats", ...g.players) : null,
    ...g.players.map((id) =>
      Promise.all([deletePlayerPhoto(id).catch(() => {}), removeAllPlayerDevices(tenant, id), removeCare(tenant, id), clearRemoval(tenant, id)]),
    ),
  ]);
  // one pass over the club's people: the team's players off their parents' lists, and
  // anyone whose own team (or a waiting child's asked-for team) it was keeps their place without it
  const updates: Promise<unknown>[] = [];
  for (const p of await listPeople(tenant)) {
    const next: Person = { ...p };
    let changed = false;
    if (next.team?.slug === team) {
      delete next.team;
      changed = true;
    }
    const kids = childrenOf(p);
    if (kids.some((c) => (c.playerId && gone.has(c.playerId)) || c.team?.slug === team || c.requestedTeam?.slug === team)) {
      next.children = kids
        .filter((c) => !(c.playerId && gone.has(c.playerId)))
        .map((c) => {
          const k = { ...c };
          if (k.team?.slug === team) delete k.team;
          if (k.requestedTeam?.slug === team) delete k.requestedTeam;
          return k;
        });
      delete next.child;
      changed = true;
    }
    if (changed) updates.push(kvCall(["HSET", peopleKey(tenant), p.userId, JSON.stringify(next)]));
  }
  await Promise.all(updates);
  await saveTeams(teams.filter((x) => x.slug !== team), tenant);
}
