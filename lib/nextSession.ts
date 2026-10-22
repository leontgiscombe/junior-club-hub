// What a team's players and families see of the training plan: the next
// session's topic and its drills, in brief — a drill's name, a line on what
// they'll do and its diagram, never the coaching points or progressions. Shown
// in the Training Hub and on Home, unless the team's coaches have hidden it
// (TrainingPlan.hiddenFromPlayers). Server only.
import { builtInDiagram } from "./builtInDrills";
import { listDrills, listPlans } from "./trainingPlans";
import { scheduleWeeks, type Drill, type TrainingPlan } from "./trainingPlanTypes";
import { listTraining, type TrainingSession } from "./trainingStorage";

export interface NextSessionDrill {
  title: string;
  kind: Drill["kind"];
  minutes: number;
  summary: string; // the first sentence of how it works
  diagram: string | null; // SVG, for built-in drills
}

export interface NextSession {
  date: string; // YYYY-MM-DD
  start: string; // "HH:MM", "" when the team has no times
  topic: string;
  week: number; // from 1
  drills: NextSessionDrill[];
}

// the date and time now in the UK, as sessions are kept
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const clockNow = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentence = /^.+?[.!?](?=\s|$)/.exec(flat)?.[0] ?? flat;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
}

function diagramOf(drill: Drill): string | null {
  for (const f of drill.files) {
    const svg = f.type === "image" ? builtInDiagram(f.name) : undefined;
    if (svg) return svg;
  }
  return null;
}

/**
 * The plan week a team's next session (today's, until it's over) is on — null
 * if it isn't on the plan. With the plan on the calendar, the week that lands
 * on that session; without, the first week not yet ticked off, as coaches see.
 */
export function nextPlanned(plan: TrainingPlan, sessions: TrainingSession[]): { session: TrainingSession; index: number } | null {
  const now = today();
  const clock = clockNow();
  const mine = sessions.filter((s) => s.team === plan.team);
  const next = mine
    .filter((s) => !s.cancelled && s.date >= now && !(s.date === now && (s.end ?? s.start ?? "24:00") <= clock))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const index = plan.startDate
    ? scheduleWeeks(plan, mine).get(next.date)
    : plan.weeks.findIndex((w) => w.drillIds.length === 0 || w.doneIds.length < w.drillIds.length);
  return index === undefined || index < 0 ? null : { session: next, index };
}

/** What a team's players can see of their next session, or null (no plan for it, or hidden by the coaches). */
export async function nextSessionFor(team: string): Promise<NextSession | null> {
  const [plans, sessions] = await Promise.all([listPlans(), listTraining()]);
  const plan = plans.find((p) => p.team === team);
  if (!plan || plan.hiddenFromPlayers) return null;
  const found = nextPlanned(plan, sessions);
  if (!found) return null;
  const week = plan.weeks[found.index];
  const library = new Map((await listDrills()).map((d) => [d.id, d]));
  const drills = week.drillIds.flatMap((id) => {
    const d = library.get(id);
    return d ? [{ title: d.title, kind: d.kind, minutes: d.minutes, summary: firstSentence(d.howItWorks || d.setup), diagram: diagramOf(d) }] : [];
  });
  if (!week.theme && drills.length === 0) return null;
  return { date: found.session.date, start: found.session.start ?? "", topic: week.theme, week: found.index + 1, drills };
}
