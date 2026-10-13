// Deleting a team for good (Settings → Teams → an archived team → Delete for
// Good): its games, training sessions and plan, its squad players (with their
// photos, medical notes and devices, and off their parents' lists), its kit
// sizes and requests, and its Finances records; anyone whose own team it was
// keeps their place in the club without it. Only an archived team, and only
// once its name is typed (app/api/teams/delete). Server only.
import { childrenOf, kvCall, peopleKey, type Person } from "./access";
import { financeKeys } from "./financeStorage";
import { getKv } from "./kv";
import { deleteSquadPlayer, listPeople } from "./people";
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
  if (g.games.length) await g.kv.hdel("matches", ...g.games);
  if (g.sessions.length) await g.kv.hdel("training", ...g.sessions);
  if (g.requests.length) await g.kv.hdel("kit_requests", ...g.requests);
  if (g.plan) await g.kv.hdel("training_plans", team);
  await g.kv.del(`kit_submissions:${team}`);
  for (const id of g.players) {
    await deletePlayerPhoto(id).catch(() => {});
    await deleteSquadPlayer(tenant, id);
  }
  const fk = financeKeys(tenant);
  await kvCall(["DEL", fk.data(team), fk.auth(team), fk.devices(team), fk.escrow(team)]);
  // people whose own team, or a waiting child's asked-for team, it was: kept, without it
  for (const p of await listPeople(tenant)) {
    let changed = false;
    const next: Person = { ...p };
    if (next.team?.slug === team) {
      delete next.team;
      changed = true;
    }
    const kids = childrenOf(p);
    if (kids.some((c) => c.team?.slug === team || c.requestedTeam?.slug === team)) {
      next.children = kids.map((c) => {
        const k = { ...c };
        if (k.team?.slug === team) delete k.team;
        if (k.requestedTeam?.slug === team) delete k.requestedTeam;
        return k;
      });
      delete next.child;
      changed = true;
    }
    if (changed) await kvCall(["HSET", peopleKey(tenant), p.userId, JSON.stringify(next)]);
  }
  await saveTeams(teams.filter((x) => x.slug !== team), tenant);
}
