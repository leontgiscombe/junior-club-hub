// Working out a team's own league record from its logged games. Shared by the
// match log's table and the presentation's record slide so the two can never
// disagree.

/** The parts of a match the record cares about. */
export interface RecordGame {
  goals: unknown[]; // our goals — only the count matters here
  opponentGoals: number;
  friendly: boolean;
  resultLogged: boolean;
}

/**
 * A game counts once its score has actually been recorded, and only if it is a
 * league game — friendlies and cup games are logged but kept out of the table.
 */
export function countsTowardsRecord(game: RecordGame): boolean {
  return game.resultLogged && !game.friendly;
}

export interface SeasonRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
}

/** Totals for games that already passed `countsTowardsRecord`. */
export function seasonRecord(games: RecordGame[]): SeasonRecord {
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let scored = 0;
  let conceded = 0;
  for (const game of games) {
    const us = game.goals.length;
    const them = game.opponentGoals;
    scored += us;
    conceded += them;
    if (us > them) won++;
    else if (us === them) drawn++;
    else lost++;
  }
  return {
    played: games.length,
    won,
    drawn,
    lost,
    scored,
    conceded,
    difference: scored - conceded,
    points: won * 3 + drawn,
  };
}

/** W/D/L for a single game, for form guides. */
export function outcome(game: RecordGame): "W" | "D" | "L" {
  const us = game.goals.length;
  const them = game.opponentGoals;
  return us > them ? "W" : us === them ? "D" : "L";
}
