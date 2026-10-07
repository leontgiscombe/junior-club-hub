// Storage for training plans: a club-wide drill library, and one plan per team
// made of weeks, each with a theme and an ordered list of drills from the
// library. Kept in the one shared KV store as two Redis hashes — "drills" keyed
// by drill id, and "training_plans" keyed by team slug.
//
// Drills are shared so a good one only has to be written once; a plan refers to
// drills by id, so editing a drill updates every week that uses it.
//
// Unlike the match and training logs, plans and drills are not cleared at the
// end of a season — they are meant to be reused.
import { getTeams } from "./settings";
import { BUILT_IN_DRILLS } from "./builtInDrills";
import {
  DRILL_KINDS,
  DRILL_TOPICS,
  type Drill,
  type DrillKind,
  type DrillTopic,
  type TrainingPlan,
} from "./trainingPlanTypes";
import { getKv } from "./kv";

export { DRILL_KINDS };
export type { Drill, DrillKind, PlanWeek, TrainingPlan } from "./trainingPlanTypes";


const DRILLS_KEY = "drills";
const PLANS_KEY = "training_plans";

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function list(value: unknown, maxItems: number, maxLength: number): string[] {
  const items = Array.isArray(value) ? value : String(value ?? "").split("\n");
  return items
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isDrillTopic(topic: string): topic is DrillTopic {
  return DRILL_TOPICS.some((t) => t.slug === topic);
}

function isDrillKind(kind: string): kind is DrillKind {
  return DRILL_KINDS.some((k) => k.slug === kind);
}

/** Only http(s) links are kept, so a stored link can always be opened safely. */
function link(value: unknown): string {
  const url = text(value, 500);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

/** Tidy a drill as sent from the page (or read back from storage). */
export function cleanDrill(raw: Partial<Drill> & Record<string, unknown>): Drill {
  const kind = text(raw.kind, 20);
  const topic = text(raw.topic, 20);
  const minutes = Math.round(Number(raw.minutes) || 0);
  return {
    id: text(raw.id, 64) || crypto.randomUUID(),
    title: text(raw.title, 120),
    kind: isDrillKind(kind) ? kind : "technical",
    topic: isDrillTopic(topic) ? topic : "",
    ageGroup: text(raw.ageGroup, 40),
    minutes: Math.min(Math.max(minutes, 0), 180),
    players: text(raw.players, 40),
    equipment: text(raw.equipment, 500),
    setup: text(raw.setup, 3000),
    howItWorks: text(raw.howItWorks, 3000),
    coachingPoints: list(raw.coachingPoints, 20, 300),
    progressions: list(raw.progressions, 20, 300),
    videoUrl: link(raw.videoUrl),
    // files and builtIn only ever come from lib/builtInDrills.ts (see listDrills)
    files: [],
    builtIn: false,
    updatedAt: text(raw.updatedAt, 40),
  };
}

function cleanPlan(team: string, raw: Partial<TrainingPlan>): TrainingPlan {
  const weeks = Array.isArray(raw.weeks) ? raw.weeks : [];
  return {
    team,
    title: text(raw.title, 120),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.startDate ?? ""))
      ? String(raw.startDate)
      : "",
    weeks: weeks.slice(0, 60).map((w) => {
      const drillIds = (Array.isArray(w?.drillIds) ? w.drillIds : [])
        .map((id) => text(id, 64))
        .filter(Boolean)
        .slice(0, 20);
      return {
        id: text(w?.id, 64) || crypto.randomUUID(),
        theme: text(w?.theme, 120),
        drillIds,
        doneIds: (Array.isArray(w?.doneIds) ? w.doneIds : [])
          .map((id) => text(id, 64))
          .filter((id) => drillIds.includes(id)),
      };
    }),
    updatedAt: text(raw.updatedAt, 40),
  };
}

function parse<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function emptyPlan(team: string): TrainingPlan {
  return { team, title: "", startDate: "", weeks: [], updatedAt: "" };
}

export function isBuiltInDrill(id: string): boolean {
  return BUILT_IN_DRILLS.some((d) => d.id === id);
}

/**
 * The library: the built-in drills, then everything coaches have added. A
 * built-in drill a coach has edited reads back as their copy, keeping its files.
 */
export async function listDrills(): Promise<Drill[]> {
  const kv = await getKv();
  const all = kv ? await kv.hgetall<Record<string, unknown>>(DRILLS_KEY) : null;
  const stored = new Map(
    Object.values(all ?? {}).map((value) => {
      const drill = cleanDrill(parse(value));
      return [drill.id, drill] as const;
    })
  );
  const builtIn = BUILT_IN_DRILLS.map((d) => {
    const edited = stored.get(d.id);
    stored.delete(d.id);
    return edited ? { ...edited, files: d.files, builtIn: true } : d;
  });
  return [...builtIn, ...stored.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/** Every team's plan — a team with nothing saved yet gets an empty one. */
export async function listPlans(): Promise<TrainingPlan[]> {
  const kv = await getKv();
  const all = kv ? await kv.hgetall<Record<string, unknown>>(PLANS_KEY) : null;
  return (await getTeams()).map((t) => {
    const stored = all?.[t.slug];
    return stored == null ? emptyPlan(t.slug) : cleanPlan(t.slug, parse(stored));
  });
}

/** Add a drill, or replace the one with the same id. */
export async function saveDrill(raw: Partial<Drill> & Record<string, unknown>): Promise<Drill> {
  const drill = cleanDrill({ ...raw, updatedAt: new Date().toISOString() });
  const kv = await getKv();
  if (kv) await kv.hset(DRILLS_KEY, { [drill.id]: JSON.stringify(drill) });
  // an edited built-in drill keeps its files, as listDrills reads it back
  const builtIn = BUILT_IN_DRILLS.find((d) => d.id === drill.id);
  return builtIn ? { ...drill, files: builtIn.files, builtIn: true } : drill;
}

/**
 * Remove a drill from the library and from every week that used it, so no
 * plan is left pointing at a drill that isn't there.
 */
export async function deleteDrill(id: string): Promise<TrainingPlan[]> {
  const kv = await getKv();
  if (!kv) return listPlans();
  await kv.hdel(DRILLS_KEY, id);
  const plans = await listPlans();
  const changed: Record<string, string> = {};
  for (const plan of plans) {
    if (!plan.weeks.some((w) => w.drillIds.includes(id))) continue;
    plan.weeks = plan.weeks.map((w) => ({
      ...w,
      drillIds: w.drillIds.filter((d) => d !== id),
    }));
    plan.updatedAt = new Date().toISOString();
    changed[plan.team] = JSON.stringify(plan);
  }
  if (Object.keys(changed).length > 0) await kv.hset(PLANS_KEY, changed);
  return plans;
}

/** Replace a team's whole plan with the one sent from the page. */
export async function savePlan(
  team: string,
  raw: Partial<TrainingPlan>
): Promise<TrainingPlan> {
  // Ticks are kept from what's stored, not taken from the page: a coach saving
  // a plan they opened earlier mustn't undo ticks made since on another phone.
  const stored = (await listPlans()).find((p) => p.team === team);
  const ticks = new Map(stored?.weeks.map((w) => [w.id, w.doneIds]) ?? []);
  const plan = cleanPlan(team, {
    ...raw,
    weeks: (raw.weeks ?? []).map((w) => ({ ...w, doneIds: ticks.get(w?.id) ?? [] })),
    updatedAt: new Date().toISOString(),
  });
  const kv = await getKv();
  if (kv) await kv.hset(PLANS_KEY, { [team]: JSON.stringify(plan) });
  return plan;
}

/**
 * Tick a drill in one of a team's weeks as done (or untick it). Saved straight
 * away, separately from the rest of the plan, so every coach sees it.
 */
export async function tickDrill(
  team: string,
  weekId: string,
  drillId: string,
  done: boolean
): Promise<TrainingPlan | null> {
  const plan = (await listPlans()).find((p) => p.team === team);
  const week = plan?.weeks.find((w) => w.id === weekId);
  if (!plan || !week || !week.drillIds.includes(drillId)) return null;
  week.doneIds = done
    ? [...new Set([...week.doneIds, drillId])]
    : week.doneIds.filter((id) => id !== drillId);
  const kv = await getKv();
  if (kv) await kv.hset(PLANS_KEY, { [team]: JSON.stringify(plan) });
  return plan;
}
