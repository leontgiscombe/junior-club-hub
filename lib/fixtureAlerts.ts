// Telling a team's families about a game (app/fixtures): the invited
// players' parents — everyone, or for a reminder only those still to answer.
// Used by the coaches' Fixtures and by the FA Full-Time sync, when it moves a
// game families have already had. Server only.
import type { Match } from "./matchStorage";
import { listPeople } from "./people";
import { getTeams } from "./settings";
import { familiesOf, invitedOf, myPlayersIn, readReplies, squadOf } from "./fixtures";
import { notifyFixture } from "./notify";
import { fixtureWhen } from "./fixtureFormat";

/** Tell the invited families about `match`; how many it went to. Never throws. */
export async function tellFamilies(
  tenant: string,
  match: Match,
  kind: "new" | "changed" | "reminder",
  /** a repeating game, set up as several at once: one alert for them all */
  series?: { count: number; every: 1 | 2 },
): Promise<number> {
  try {
    const [people, teams, squad, replies] = await Promise.all([
      listPeople(tenant),
      getTeams(),
      squadOf(match.team),
      kind === "reminder" ? readReplies(match.id) : null,
    ]);
    const invited = invitedOf(squad, match);
    let families = familiesOf(people, match.team).filter((p) => myPlayersIn(p, invited).length > 0);
    if (replies) families = families.filter((p) => myPlayersIn(p, invited).some((c) => !replies.players[c.playerId]));
    return await notifyFixture(tenant, {
      id: match.id,
      teamName: teams.find((t) => t.slug === match.team)?.name ?? "Your team",
      opponent: match.opponent,
      when: fixtureWhen(match),
      kind,
      series,
      userIds: families.map((p) => p.userId),
    });
  } catch (e) {
    console.error("Fixture alerts not sent:", e);
    return 0;
  }
}
