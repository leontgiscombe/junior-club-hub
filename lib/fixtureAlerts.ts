// Telling a team's families about a game (app/fixtures): the invited
// players' parents — everyone, or for a reminder only those still to answer.
// Used by the coaches' Fixtures and by the FA Full-Time sync, when it moves a
// game families have already had. Server only.
import type { Match } from "./matchStorage";
import { listPeople } from "./people";
import { getClub, getTeams } from "./settings";
import { familiesOf, hostsFor, invitedOf, myPlayersIn, readReplies, squadOf } from "./fixtures";
import { notifyFixture } from "./notify";
import { fixtureTeamName, fixtureWhen } from "./fixtureFormat";

/** Tell the invited families about `match`, and the coaches asked to host it; how many families it went to. Never throws. */
export async function tellFamilies(
  tenant: string,
  match: Match,
  kind: "new" | "changed" | "reminder",
  /** a repeating game, set up as several at once: one alert for them all */
  series?: { count: number; every: 1 | 2 },
  /** the coach doing the sending, who doesn't need telling */
  from?: string,
): Promise<number> {
  try {
    const [people, teams, club, squad, replies] = await Promise.all([
      listPeople(tenant),
      getTeams(),
      getClub(),
      squadOf(match.team),
      kind === "reminder" ? readReplies(match.id) : null,
    ]);
    const invited = invitedOf(squad, match);
    let families = familiesOf(people, match.team).filter((p) => myPlayersIn(p, invited).length > 0);
    if (replies) families = families.filter((p) => myPlayersIn(p, invited).some((c) => !replies.players[c.playerId]));
    const game = {
      id: match.id,
      teamName: ((t) => (t ? fixtureTeamName(club.name, t) : "Your team"))(teams.find((t) => t.slug === match.team)),
      opponent: match.opponent,
      when: fixtureWhen(match),
      kind,
      series,
    };
    // the coaches asked to host it: everyone but the sender (for a reminder, those still to say)
    const hosts = hostsFor(people, match).filter((h) => h.userId !== from && (!replies || !replies.hosts[h.userId]));
    if (hosts.length) await notifyFixture(tenant, { ...game, hosts: true, userIds: hosts.map((h) => h.userId) });
    return await notifyFixture(tenant, { ...game, userIds: families.map((p) => p.userId) });
  } catch (e) {
    console.error("Fixture alerts not sent:", e);
    return 0;
  }
}
