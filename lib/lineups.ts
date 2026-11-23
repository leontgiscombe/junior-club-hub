// Line-ups (a coach's, on a game: app/admin/fixtures/[id]): the team sizes,
// the formations for each — the outfield lines from the back, the keeper
// apart — and the positions a formation makes. No server-only imports, so
// the line-up editor can use it too.
import type { GameFormat } from "./clubSettings";

/** The formations for each team size, the usual ones first. */
export const LINEUP_FORMATIONS: Record<number, string[]> = {
  5: ["1-2-1", "2-1-1", "1-1-2", "2-2", "3-1", "1-3"],
  7: ["1-3-2", "1-4-1", "2-1-3", "2-2-2", "2-3-1", "2-4-0", "3-1-2", "3-2-1", "4-1-1"],
  9: ["2-3-3", "2-4-2", "3-2-3", "3-3-2", "3-4-1", "4-3-1", "3-1-3-1", "2-3-2-1"],
  11: ["4-4-2", "4-3-3", "4-2-3-1", "4-1-4-1", "4-5-1", "3-5-2", "3-4-3", "5-3-2", "5-4-1"],
};
export const LINEUP_SIZES = Object.keys(LINEUP_FORMATIONS).map(Number);

/** A team's usual size, from its format ("7v7" → 7). */
export const sizeOfFormat = (format: GameFormat) => Number(format.split("v")[0]) || 7;

/** How many players a formation puts out, keeper included ("2-3-1" → 7). */
export const formationSize = (formation: string) => formation.split("-").reduce((n, x) => n + (Number(x) || 0), 1);

export const isLineupFormation = (f: string) => Object.values(LINEUP_FORMATIONS).some((list) => list.includes(f));

export type LineupSlot = {
  label: string;
  /** 0 for the keeper, then each line from the back */
  line: number;
  /** how many lines the formation has, keeper apart — a line of nobody ("2-4-0") still counts, so the others keep their places */
  lines: number;
  index: number;
  of: number;
};

/** A formation's positions: the keeper, then each line from the back. */
export function lineupSlots(formation: string): LineupSlot[] {
  const lines = formation.split("-").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const names = lines.length === 4 ? ["DEF", "DM", "AM", "FWD"] : lines.length === 2 ? ["DEF", "FWD"] : ["DEF", "MID", "FWD"];
  const out: LineupSlot[] = [{ label: "GK", line: 0, lines: lines.length, index: 0, of: 1 }];
  lines.forEach((n, li) => {
    for (let i = 0; i < n; i++) out.push({ label: names[li] ?? "MID", line: li + 1, lines: lines.length, index: i, of: n });
  });
  return out;
}
