// Player of the month: every award a team gave out in a calendar month — best
// trainer from the training log, most improved and player of the match from
// the match log — and who comes out on top.
//
// Each award is worth one point. A tie on points goes to whoever won more
// different kinds of award, then more player of the match awards, then
// whoever won an award most recently. The coach can still pick someone else.

export type MonthAwardKind = "bestTrainer" | "mostImproved" | "potm";

export const MONTH_AWARD_KINDS: {
  kind: MonthAwardKind;
  label: string;
  plural: string;
  icon: string;
}[] = [
  { kind: "bestTrainer", label: "Best Trainer", plural: "best trainer awards", icon: "👟" },
  { kind: "mostImproved", label: "Most Improved", plural: "most improved awards", icon: "📈" },
  { kind: "potm", label: "Player of the Match", plural: "player of the match awards", icon: "🏆" },
];

export interface MonthAward {
  kind: MonthAwardKind;
  playerId: string;
  date: string; // YYYY-MM-DD
}

export interface MonthStanding {
  playerId: string;
  points: number;
  counts: Record<MonthAwardKind, number>;
  latest: string; // date of their most recent award
}

interface AwardMatch {
  team: string;
  date: string;
  potmId: string;
  mostImprovedId: string;
}

interface AwardSession {
  team: string;
  date: string;
  bestTrainerId: string;
  cancelled: boolean;
}

/** "2026-09-14" → "2026-09" */
const monthOf = (date: string) => date.slice(0, 7);

/** Every award a team gave in a month ("YYYY-MM"), in date order. */
export function monthAwards(
  team: string,
  month: string,
  matches: AwardMatch[],
  sessions: AwardSession[]
): MonthAward[] {
  const awards: MonthAward[] = [];
  for (const s of sessions) {
    if (s.team !== team || monthOf(s.date) !== month || s.cancelled || !s.bestTrainerId) continue;
    awards.push({ kind: "bestTrainer", playerId: s.bestTrainerId, date: s.date });
  }
  for (const m of matches) {
    if (m.team !== team || monthOf(m.date) !== month) continue;
    if (m.mostImprovedId) awards.push({ kind: "mostImproved", playerId: m.mostImprovedId, date: m.date });
    if (m.potmId) awards.push({ kind: "potm", playerId: m.potmId, date: m.date });
  }
  return awards.sort((a, b) => a.date.localeCompare(b.date));
}

/** The months ("YYYY-MM") in which a team gave any award, latest first. */
export function monthsWithAwards(
  team: string,
  matches: AwardMatch[],
  sessions: AwardSession[]
): string[] {
  const months = new Set<string>();
  for (const s of sessions) {
    if (s.team === team && !s.cancelled && s.bestTrainerId) months.add(monthOf(s.date));
  }
  for (const m of matches) {
    if (m.team === team && (m.potmId || m.mostImprovedId)) months.add(monthOf(m.date));
  }
  return [...months].sort().reverse();
}

const distinctKinds = (s: MonthStanding) =>
  MONTH_AWARD_KINDS.filter((k) => s.counts[k.kind] > 0).length;

/** One standing per player who won anything, best first (see the rules above). */
export function monthStandings(awards: MonthAward[]): MonthStanding[] {
  const byPlayer = new Map<string, MonthStanding>();
  for (const a of awards) {
    const s = byPlayer.get(a.playerId) ?? {
      playerId: a.playerId,
      points: 0,
      counts: { bestTrainer: 0, mostImproved: 0, potm: 0 },
      latest: "",
    };
    s.points += 1;
    s.counts[a.kind] += 1;
    if (a.date > s.latest) s.latest = a.date;
    byPlayer.set(a.playerId, s);
  }
  return [...byPlayer.values()].sort(
    (a, b) =>
      b.points - a.points ||
      distinctKinds(b) - distinctKinds(a) ||
      b.counts.potm - a.counts.potm ||
      b.latest.localeCompare(a.latest)
  );
}

/** Whether the top two are level on points, so a tie-break decided it. */
export function decidedByTieBreak(standings: MonthStanding[]): boolean {
  return standings.length > 1 && standings[0].points === standings[1].points;
}

/** "2026-09" → "September" */
export function monthName(month: string): string {
  const d = new Date(`${month}-01T00:00`);
  return d.toLocaleDateString("en-GB", { month: "long" });
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "2026-09-07" → "7th Sept" */
export function posterDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const suffix =
    d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${d}${suffix} ${SHORT_MONTHS[m - 1]}`;
}

/**
 * The name a player goes by on the poster: their first name, with their
 * surname's initial only when someone else in the squad shares it. A poster
 * gets shared, so children's full names stay off it.
 */
export function posterName(
  player: { id: string; name: string },
  squad: { id: string; name: string }[]
): string {
  const first = (n: string) => n.trim().split(/\s+/)[0] ?? "";
  const parts = player.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const clash = squad.some(
    (p) => p.id !== player.id && first(p.name).toLowerCase() === parts[0].toLowerCase()
  );
  return clash ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}
