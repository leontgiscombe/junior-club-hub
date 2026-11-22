// A coach adding a fixture (app/fixtures/FixtureForm.tsx).
import { redirect } from "next/navigation";
import { TopBar } from "../../components/SettingsUI";
import { listMatches } from "@/lib/matchStorage";
import { getClub } from "@/lib/settings";
import { fixturesViewer } from "../viewer";
import FixtureForm, { type Venue } from "../FixtureForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `New fixture – ${club.name}` };
}

export default async function NewFixture({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const v = await fixturesViewer("/fixtures/new");
  if (!v.coach) redirect("/fixtures");
  const q = await searchParams;
  const team = v.teams.some((t) => t.slug === q.team) ? q.team! : v.person.team?.slug && v.teams.some((t) => t.slug === v.person.team?.slug) ? v.person.team.slug : v.teams.length === 1 ? v.teams[0].slug : "";
  const venues: Venue[] = (await listMatches().catch(() => []))
    .filter((m) => m.venue)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ team: m.team, venue: m.venue, address: m.address, home: m.home }));
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-16 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title="New fixture" href="/fixtures" />
      <div className="mx-auto max-w-xl px-4">
        <FixtureForm
          teams={v.teams.map((t) => ({ slug: t.slug, name: t.name, opponents: t.opponents ?? [] }))}
          venues={venues}
          initial={{ team, type: "league", opponent: "", home: true, date: "", time: "", meetTime: "", venue: "", address: "", notes: "" }}
        />
      </div>
    </main>
  );
}
