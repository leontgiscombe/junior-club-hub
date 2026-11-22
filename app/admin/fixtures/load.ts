// What the coaches' Fixtures pages need: a signed-in coach (anyone else goes
// to the families' Fixtures), and for setting a game up, each team with its
// squad and league opponents, and the grounds played at before. Server only.
import { redirect } from "next/navigation";
import { listMatches } from "@/lib/matchStorage";
import { listPlayers } from "@/lib/statsStorage";
import { fixturesViewer } from "../../fixtures/viewer";
import type { Venue, WizardTeam } from "./FixtureWizard";

export async function coachViewer(next: string) {
  const v = await fixturesViewer(next);
  if (!v.coach) redirect("/fixtures");
  return v;
}

export async function wizardData(teams: { slug: string; name: string; opponents?: string[] }[]): Promise<{ teams: WizardTeam[]; venues: Venue[] }> {
  const [players, matches] = await Promise.all([listPlayers().catch(() => []), listMatches().catch(() => [])]);
  return {
    teams: teams.map((t) => ({
      slug: t.slug,
      name: t.name,
      opponents: t.opponents ?? [],
      squad: players.filter((p) => p.team === t.slug).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, name: p.name })),
    })),
    venues: matches
      .filter((m) => m.venue)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({ team: m.team, venue: m.venue, address: m.address, home: m.home })),
  };
}
