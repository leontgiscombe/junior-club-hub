// Milestones worth a mention in the group chat — a player's 10th goal, 50th
// appearance and so on. Worked out from the season tallies, so there is
// nothing extra to record.
import type { Player, StatField } from "./statsStorage";

const LEVELS: {
  field: StatField;
  label: string;
  /** Used when the mark is 1, so it reads "1 penalty saved". */
  singular?: string;
  icon: string;
  marks: number[];
}[] = [
  { field: "goals", label: "goals", icon: "⚽", marks: [5, 10, 25, 50, 100] },
  { field: "assists", label: "assists", icon: "🅰️", marks: [5, 10, 25, 50] },
  { field: "appearances", label: "appearances", icon: "👟", marks: [10, 25, 50, 100] },
  { field: "saves", label: "saves", icon: "🧤", marks: [10, 25, 50, 100] },
  {
    field: "penaltiesSaved",
    label: "penalties saved",
    singular: "penalty saved",
    icon: "⛔",
    marks: [1, 3, 5],
  },
  { field: "potm", label: "player of the match awards", icon: "🏆", marks: [3, 5, 10] },
];

function markLabel(level: (typeof LEVELS)[number], mark: number): string {
  return `${mark} ${mark === 1 ? (level.singular ?? level.label) : level.label}`;
}

export interface Milestone {
  playerId: string;
  playerName: string;
  icon: string;
  /** e.g. "10 goals" */
  label: string;
  value: number;
}

export interface Approaching extends Milestone {
  /** How many more are needed to reach it. */
  away: number;
}

/** How close a player must be to a mark before it is worth mentioning. */
const NEARLY = 2;

/**
 * The highest mark each player has passed for each stat — one entry per
 * player/stat, so a 27-goal season reads "25 goals" rather than listing every
 * mark below it.
 */
export function reachedMilestones(players: Player[]): Milestone[] {
  const out: Milestone[] = [];
  for (const player of players) {
    for (const level of LEVELS) {
      const value = player[level.field] ?? 0;
      const passed = level.marks.filter((mark) => value >= mark);
      if (passed.length === 0) continue;
      const highest = passed[passed.length - 1];
      out.push({
        playerId: player.id,
        playerName: player.name,
        icon: level.icon,
        label: markLabel(level, highest),
        value: highest,
      });
    }
  }
  return out.sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName));
}

/** Players within a couple of a mark they have not reached yet. */
export function approachingMilestones(players: Player[]): Approaching[] {
  const out: Approaching[] = [];
  for (const player of players) {
    for (const level of LEVELS) {
      const value = player[level.field] ?? 0;
      const next = level.marks.find((mark) => mark > value);
      if (next === undefined) continue;
      const away = next - value;
      // Ignore someone on nothing at all — "2 away from 5 goals" on 3 is
      // interesting, on 0 it is not.
      if (away > NEARLY || value === 0) continue;
      out.push({
        playerId: player.id,
        playerName: player.name,
        icon: level.icon,
        label: markLabel(level, next),
        value: next,
        away,
      });
    }
  }
  return out.sort((a, b) => a.away - b.away || a.playerName.localeCompare(b.playerName));
}
