import { getKv, keyPrefix, rawKv } from "./kv";
import { requireTenant } from "./tenant";
import { awardSlotsFor, type AwardBallot, type SeasonAward } from "./seasonAwards";
import { childrenOf, type Person } from "./access";
import { getCurrentSeason } from "./season";

const AWARDS_KEY = "season_awards";
const ballotsKey = (id: string) => `season_awards_ballots:${id}`;
const activationKey = (season: string) => `season_awards_active:${encodeURIComponent(season)}`;

function parse<Value>(value: unknown): Value {
  return (typeof value === "string" ? JSON.parse(value) : value) as Value;
}

async function database() {
  const kv = await getKv();
  if (!kv) throw new Error("Awards storage is unavailable. Please try again later.");
  return kv;
}

export async function activeAwardTeams(season: string): Promise<string[]> {
  const all = await (await database()).hgetall<Record<string, unknown>>(activationKey(season));
  return Object.entries(all ?? {}).filter(([, active]) => active === true || active === "true").map(([team]) => team);
}

export async function setAwardsActive(season: string, team: string, active: boolean): Promise<boolean> {
  const tenant = await requireTenant();
  await database();
  const kv = await rawKv();
  if (!kv) throw new Error("Awards storage is unavailable. Please try again later.");
  const result = await kv.eval(`
    local previous = redis.call('HGET', KEYS[1], ARGV[1])
    redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
    if ARGV[2] == 'true' and previous ~= 'true' then return 1 end
    return 0
  `, [keyPrefix(tenant) + activationKey(season)], [team, JSON.stringify(active)]);
  return result === 1;
}

export async function parentAwardsVisible(person: Person | null): Promise<boolean> {
  if (person?.status !== "approved") return false;
  const teams = childrenOf(person).filter((child) => !child.pending && child.team).map((child) => child.team!.slug);
  if (!teams.length) return false;
  const season = await getCurrentSeason();
  const activeTeams = (await activeAwardTeams(season)).filter((team) => teams.includes(team));
  if (!activeTeams.length) return false;
  // and an award this season they have a ballot in (not only ones the coaches decide)
  const kids = childrenOf(person);
  return (await listSeasonAwards()).some((award) => award.season === season && activeTeams.includes(award.team) && awardSlotsFor(award, kids).length > 0);
}

export async function listSeasonAwards(): Promise<SeasonAward[]> {
  const all = await (await database()).hgetall<Record<string, unknown>>(AWARDS_KEY);
  return Object.values(all ?? {}).map((value) => parse<SeasonAward>(value));
}

export async function getSeasonAward(id: string): Promise<SeasonAward | null> {
  const value = await (await database()).hget<unknown>(AWARDS_KEY, id);
  return value == null ? null : parse<SeasonAward>(value);
}

export async function saveSeasonAward(award: SeasonAward): Promise<void> {
  await (await database()).hset(AWARDS_KEY, { [award.id]: JSON.stringify(award) });
}

export async function removeSeasonAward(id: string): Promise<void> {
  const tenant = await requireTenant();
  await database();
  const kv = await rawKv();
  if (!kv) throw new Error("Awards storage is unavailable. Please try again later.");
  const prefix = keyPrefix(tenant);
  await kv.eval("redis.call('HDEL', KEYS[1], ARGV[1]); redis.call('DEL', KEYS[2]); return 1", [prefix + AWARDS_KEY, prefix + ballotsKey(id)], [id]);
}

export async function awardBallots(id: string): Promise<AwardBallot[]> {
  const all = await (await database()).hgetall<Record<string, unknown>>(ballotsKey(id));
  return Object.values(all ?? {}).map((value) => parse<AwardBallot>(value));
}

/** The ballot kept at `field` (ballotField: a parent's account, or a child's for a players' award). */
export async function ownAwardBallot(id: string, field: string): Promise<AwardBallot | null> {
  const value = await (await database()).hget<unknown>(ballotsKey(id), field);
  return value == null ? null : parse<AwardBallot>(value);
}

export async function submitAwardBallot(id: string, field: string, season: string, choices: string[], by?: string): Promise<boolean> {
  const tenant = await requireTenant();
  await database();
  const kv = await rawKv();
  if (!kv) throw new Error("Awards storage is unavailable. Please try again later.");
  const prefix = keyPrefix(tenant);
  const ballot: AwardBallot = { choices, updatedAt: new Date().toISOString(), ...(by ? { by } : {}) };
  const result = await kv.eval(`
    local stored = redis.call('HGET', KEYS[1], ARGV[1])
    if not stored then return 0 end
    local award = cjson.decode(stored)
    if not award.open or award.season ~= ARGV[2] or award.voters == 'coaches' then return 0 end
    if redis.call('HGET', KEYS[3], award.team) ~= 'true' then return 0 end
    redis.call('HSET', KEYS[2], ARGV[3], ARGV[4])
    return 1
  `, [prefix + AWARDS_KEY, prefix + ballotsKey(id), prefix + activationKey(season)], [id, season, field, JSON.stringify(ballot)]);
  return result === 1;
}