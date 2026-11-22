// Who's looking at Fixtures, and which teams' games are theirs: a coach sees
// every team's (starting on their own), anyone else their own and their
// children's teams'. Server only.
import { redirect } from "next/navigation";
import { teamsOf } from "@/lib/access";
import { canCoach, currentPerson } from "@/lib/people";
import { getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export async function fixturesViewer(next: string) {
  const tenant = await getTenant();
  if (!tenant) redirect("/");
  const me = await currentPerson(tenant).catch(() => null);
  if (!me) redirect(`/signin?next=${encodeURIComponent(next)}`);
  const person = me.person?.status === "approved" ? me.person : null;
  if (!person) redirect("/");
  const teams = await getTeams();
  const coach = canCoach(person);
  const mine = teamsOf(person).filter((slug) => teams.some((t) => t.slug === slug));
  const visible = coach ? teams.map((t) => t.slug) : mine;
  return { tenant, person, coach, teams, mine, visible };
}
