// The shapes and drill types shared by the training plans page and its
// storage (lib/trainingPlans.ts), kept apart so the page doesn't pull in KV.
import { teamAge, teamFormat, type GameFormat, type Team } from "./clubSettings";

export const DRILL_KINDS = [
  { slug: "warm-up", name: "Warm-up" },
  { slug: "technical", name: "Technical" },
  { slug: "game", name: "Game" },
] as const;

export type DrillKind = (typeof DRILL_KINDS)[number]["slug"];

// What a drill works on — matches the themes weeks are usually given, so a
// week's drills can be picked from the right topic.
export const DRILL_TOPICS = [
  { slug: "passing", name: "Passing" },
  { slug: "dribbling", name: "Dribbling" },
  { slug: "movement", name: "Movement" },
  { slug: "defending", name: "Defending" },
  { slug: "finishing", name: "Finishing" },
  { slug: "control", name: "Control / Turning" },
  { slug: "goalkeeping", name: "Goalkeeping" },
] as const;

export type DrillTopic = (typeof DRILL_TOPICS)[number]["slug"];

export function topicName(topic: string): string {
  return DRILL_TOPICS.find((t) => t.slug === topic)?.name ?? "";
}

// The ages a drill is for, youngest first: the drill library filters on them,
// and each has its own season plan in the drill pack.
export const AGE_BANDS = [
  { slug: "u8", name: "U8", oldest: 8 },
  { slug: "u9-11", name: "U9–11", oldest: 11 },
  { slug: "u12-14", name: "U12–14", oldest: 14 },
  { slug: "u15-17", name: "U15–17", oldest: 17 },
  { slug: "u18", name: "U18", oldest: Infinity },
] as const;

export type AgeBand = (typeof AGE_BANDS)[number]["slug"];

export const isAgeBand = (v: unknown): v is AgeBand => AGE_BANDS.some((b) => b.slug === v);

export function bandName(band: string): string {
  return AGE_BANDS.find((b) => b.slug === band)?.name ?? "";
}

/** The band an age group (Under 13s is 13) is in. */
export function bandForAge(age: number): AgeBand {
  return AGE_BANDS.find((b) => age <= b.oldest)!.slug;
}

/** A drill's band, from its age group as stored: a band, or free text from before bands ("U10", "U9–U11": its youngest age). */
export function bandOf(ageGroup: string): AgeBand | "" {
  if (isAgeBand(ageGroup)) return ageGroup;
  const age = Number(/\d{1,2}/.exec(ageGroup)?.[0] ?? NaN);
  return Number.isFinite(age) ? bandForAge(age) : "";
}

// for a team saved before teams had a year: the band its format mostly is
const FORMAT_BAND: Record<GameFormat, AgeBand> = { "5v5": "u8", "7v7": "u9-11", "9v9": "u9-11", "11v11": "u12-14" };

/** A team's band: from its age group (or an age in its name), else its format. */
export function teamBand(team: Pick<Team, "name" | "format" | "age">): AgeBand {
  const age = teamAge(team);
  return age === undefined ? FORMAT_BAND[teamFormat(team)] : bandForAge(age);
}

export interface Drill {
  id: string;
  title: string;
  kind: DrillKind;
  topic: DrillTopic | ""; // "" when not given
  ageGroup: AgeBand | ""; // the ages it's for (AGE_BANDS); "" for any age
  minutes: number; // 0 when not given
  players: string; // free text, e.g. "8–12"
  equipment: string;
  setup: string;
  howItWorks: string;
  coachingPoints: string[];
  progressions: string[];
  videoUrl: string; // "" when none — a link to a clip, not an upload
  // Session-plan pages and PDFs, served to coaches by /api/training/files.
  // Only built-in drills have them (see lib/builtInDrills.ts).
  files: DrillFile[];
  // Photos and PDFs a coach has added to the drill (lib/trainingPlans.ts
  // addDrillUpload), served to coaches by /api/training/files.
  uploads: DrillUpload[];
  // Ships with the app rather than being added by a coach: it can be edited,
  // but not deleted.
  builtIn: boolean;
  updatedAt: string;
}

export interface DrillFile {
  name: string; // file name in drill-pack/files/
  label: string;
  type: "image" | "pdf";
}

export interface DrillUpload {
  id: string;
  label: string; // the file's name as it was chosen, e.g. "Whiteboard.jpg"
  type: "image" | "pdf";
}

/** A drill can have this many photos and PDFs of its own. */
export const MAX_DRILL_UPLOADS = 3;

export interface PlanWeek {
  id: string;
  theme: string;
  drillIds: string[];
  // The drills ticked off as done in this week's session — always a subset of
  // drillIds. Changed only by ticking (tickDrill), never by saving the plan.
  doneIds: string[];
}

export interface TrainingPlan {
  team: string; // team slug (see lib/teams.ts)
  title: string;
  // The training session week 1 lands on, YYYY-MM-DD — "" until the plan is scheduled.
  startDate: string;
  weeks: PlanWeek[];
  updatedAt: string;
}

/**
 * Which plan week each of a team's training sessions gets, as date -> week
 * index. Weeks land on the team's training sessions in order from the plan's
 * start date, skipping any session marked as no training — so a called-off
 * session pushes the plan back one rather than losing that week's session.
 */
export function scheduleWeeks(
  plan: Pick<TrainingPlan, "startDate" | "weeks">,
  sessions: { date: string; cancelled: boolean }[]
): Map<string, number> {
  const byDate = new Map<string, number>();
  if (!plan.startDate || plan.weeks.length === 0) return byDate;
  const dates = sessions
    .filter((s) => !s.cancelled && s.date >= plan.startDate)
    .map((s) => s.date)
    .sort();
  dates.slice(0, plan.weeks.length).forEach((date, i) => byDate.set(date, i));
  return byDate;
}
