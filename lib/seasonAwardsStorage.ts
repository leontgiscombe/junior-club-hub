import { getKv, keyPrefix, rawKv } from "./kv";
import { requireTenant } from "./tenant";
import type { AwardBallot, SeasonAward } from "./seasonAwards";

const AWARDS_KEY = "season_awards";
const ballotsKey = (id: string) => `season_awards_ballots:${id}`;

function parse<Value>(value: unknown): Value {
  return (typeof value === "string" ? JSON.parse(value) : value) as Value;
}

async function database() {
  const kv = await getKv();
  if (!kv) throw new Error("Awards storage is unavailable. Please try again later.");
  return kv;
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

export async function ownAwardBallot(id: string, userId: string): Promise<AwardBallot | null> {
  const value = await (await database()).hget<unknown>(ballotsKey(id), userId);
  return value == null ? null : parse<AwardBallot>(value);
}

export async function submitAwardBallot(id: string, userId: string, season: string, choices: string[]): Promise<boolean> {
  const tenant = await requireTenant();
  await database();
  const kv = await rawKv();
  if (!kv) throw new Error("Awards storage is unavailable. Please try again later.");
  const prefix = keyPrefix(tenant);
  const ballot: AwardBallot = { choices, updatedAt: new Date().toISOString() };
  const result = await kv.eval(`
    local stored = redis.call('HGET', KEYS[1], ARGV[1])
    if not stored then return 0 end
    local award = cjson.decode(stored)
    if not award.open or award.season ~= ARGV[2] then return 0 end
    redis.call('HSET', KEYS[2], ARGV[3], ARGV[4])
    return 1
  `, [prefix + AWARDS_KEY, prefix + ballotsKey(id)], [id, season, userId, JSON.stringify(ballot)]);
  return result === 1;
}