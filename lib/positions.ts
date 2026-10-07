// Which stats are worth showing for a player, by position.
//
// Every player record carries every tally (see STAT_FIELDS in
// lib/statsStorage.ts) — a goalkeeper who pops up for a corner and scores still
// has that goal recorded. What changes with position is what the tracker,
// awards and presentation put in front of you: judging a keeper on goals and
// assists tells you nothing, while saves and penalties saved do.
//
// Types only from lib/statsStorage, so this is safe to import from a client
// component without pulling the KV client into the bundle.
import type { Position, StatField } from "./statsStorage";

const OUTFIELD: StatField[] = [
  "appearances",
  "goals",
  "assists",
  "potm",
  "mostImproved",
  "bestTrainer",
];

const GOALKEEPER: StatField[] = [
  "appearances",
  "saves",
  "penaltiesSaved",
  "potm",
  "mostImproved",
  "bestTrainer",
];

/** The stats normally shown for a player in this position. */
export function statsForPosition(position: Position | undefined): StatField[] {
  return position === "goalkeeper" ? GOALKEEPER : OUTFIELD;
}

/**
 * Stats only a goalkeeper accrues. They belong on a keeper's own card, not in
 * a squad total: adding up a side's saves says nothing about the side, and in
 * a squad with one keeper it is a column of noughts next to their name.
 */
const KEEPER_ONLY: StatField[] = ["saves", "penaltiesSaved"];

export function isKeeperStat(field: StatField): boolean {
  return KEEPER_ONLY.includes(field);
}

/**
 * The stats to show for one player: the ones their position is judged on, plus
 * anything they have actually recorded — so a keeper's goal, or an outfielder
 * covering in nets and keeping a clean sheet, is never hidden.
 */
export function statsForPlayer(
  player: { position?: Position } & Partial<Record<StatField, number>>,
  order: readonly StatField[]
): StatField[] {
  const shown = new Set(statsForPosition(player.position));
  return order.filter((field) => shown.has(field) || (player[field] ?? 0) > 0);
}

/**
 * The stats to show for a whole squad — the union of what its players are
 * judged on, plus anything anyone has recorded. A squad with no keeper in it
 * doesn't get two columns of zeroes.
 */
export function statsForSquad(
  players: ({ position?: Position } & Partial<Record<StatField, number>>)[],
  order: readonly StatField[]
): StatField[] {
  const shown = new Set<StatField>();
  for (const player of players) {
    for (const field of statsForPlayer(player, order)) shown.add(field);
  }
  return order.filter((field) => shown.has(field));
}

/** Label for the position toggle. */
export function positionLabel(position: Position | undefined): string {
  return position === "goalkeeper" ? "Goalkeeper" : "Outfield";
}

export function positionIcon(position: Position | undefined): string {
  return position === "goalkeeper" ? "🧤" : "👕";
}
