// The shapes and drill types shared by the training plans page and its
// storage (lib/trainingPlans.ts), kept apart so the page doesn't pull in KV.

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

export interface Drill {
  id: string;
  title: string;
  kind: DrillKind;
  topic: DrillTopic | ""; // "" when not given
  ageGroup: string; // free text, e.g. "U9–U11"
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
  // The Monday week 1 lands on, YYYY-MM-DD — "" until the plan is scheduled.
  startDate: string;
  weeks: PlanWeek[];
  updatedAt: string;
}

/**
 * Which plan week each of a team's training sessions gets, as date -> week
 * index. Weeks land on the team's Mondays in order from the plan's start date,
 * skipping any session marked as no training — so a called-off Monday pushes
 * the plan back a week rather than losing that week's session.
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
