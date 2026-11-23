// What the coaches' Fixtures pages need: a signed-in coach (anyone else goes
// to the families' Fixtures), and for setting a game up, each team with its
// squad and league opponents, and the grounds played at before. Server only.
import { redirect } from "next/navigation";
import { listMatches } from "@/lib/matchStorage";
import { listPlayers } from "@/lib/statsStorage";
import { listPeople } from "@/lib/people";
import { isCoachPerson } from "@/lib/fixtures";
import { fixturesViewer } from "../../fixtures/viewer";
import type { Coach, LastKits, Venue, WizardTeam } from "./FixtureWizard";

export async function coachViewer(next: string) {
  const v = await fixturesViewer(next);
  if (!v.coach) redirect("/fixtures");
  return v;
}

export async function wizardData(
  teams: { slug: string; name: string; age?: number; opponents?: string[] }[],
  tenant: string,
): Promise<{ teams: WizardTeam[]; venues: Venue[]; lastKits: LastKits; coaches: Coach[] }> {
  const [players, matches, people] = await Promise.all([listPlayers().catch(() => []), listMatches().catch(() => []), listPeople(tenant).catch(() => [])]);
  // the club's coaches and admins, who can be asked to host a game
  const coaches: Coach[] = people
    .filter(isCoachPerson)
    .map((p) => ({ userId: p.userId, name: p.name, team: p.team?.slug ?? "", admin: p.roles.includes("admin") }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // each team's colours in its latest home and away games
  const lastKits: LastKits = {};
  for (const m of [...matches].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!m.ourKit && !m.theirKit) continue;
    (lastKits[m.team] ??= {})[m.home ? "home" : "away"] = { ourKit: m.ourKit, theirKit: m.theirKit };
  }
  return {
    coaches,
    lastKits,
    teams: teams.map((t) => ({
      slug: t.slug,
      name: t.name,
      age: t.age,
      opponents: t.opponents ?? [],
      squad: players.filter((p) => p.team === t.slug).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, name: p.name })),
    })),
    venues: matches
      .filter((m) => m.venue)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({ team: m.team, venue: m.venue, address: m.address, home: m.home })),
  };
}
