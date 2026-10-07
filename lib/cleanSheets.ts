// Clean sheets belong to the team, not to its players.
//
// A clean sheet is a game the team didn't concede in, so it is counted in
// games, not against anybody's name: one per match, shown with the team's
// record rather than on a player's card. It is read straight off the match log
// — there is nothing to record and nothing to keep in step.
//
// Pure functions with no storage behind them, so the same rule drives the
// match log, the stats page, the parents' results page and the presentation.

export interface CleanSheetGame {
  opponentGoals: number;
  resultLogged: boolean;
}

/** True when a game's score is logged and the opponent didn't score. */
export function isCleanSheet(game: CleanSheetGame): boolean {
  return game.resultLogged && game.opponentGoals === 0;
}

/** How many of these games the team kept a clean sheet in. */
export function cleanSheetCount(games: CleanSheetGame[]): number {
  return games.filter(isCleanSheet).length;
}

/** Games with a score logged — what the clean-sheet count is out of. */
export function playedCount(games: CleanSheetGame[]): number {
  return games.filter((game) => game.resultLogged).length;
}
