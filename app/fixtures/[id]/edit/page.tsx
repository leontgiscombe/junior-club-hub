// A coach changing a fixture's details (app/fixtures/FixtureForm.tsx).
import { notFound, redirect } from "next/navigation";
import { TopBar } from "../../../components/SettingsUI";
import { getMatch, listMatches } from "@/lib/matchStorage";
import { getClub } from "@/lib/settings";
import { fixturesViewer } from "../../viewer";
import FixtureForm, { type Venue } from "../../FixtureForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Edit fixture – ${club.name}` };
}

export default async function EditFixture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await fixturesViewer(`/fixtures/${id}/edit`);
  if (!v.coach) redirect(`/fixtures/${id}`);
  const match = await getMatch(id).catch(() => null);
  if (!match) notFound();
  const venues: Venue[] = (await listMatches().catch(() => []))
    .filter((m) => m.venue)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ team: m.team, venue: m.venue, address: m.address, home: m.home }));
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-16 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title="Edit fixture" href={`/fixtures/${id}`} />
      <div className="mx-auto max-w-xl px-4">
        <FixtureForm
          matchId={match.id}
          sent={!!match.sentAt}
          teams={v.teams.map((t) => ({ slug: t.slug, name: t.name, opponents: t.opponents ?? [] }))}
          venues={venues}
          initial={{
            team: match.team,
            type: match.cup ? "cup" : match.friendly ? "friendly" : "league",
            opponent: match.opponent,
            home: match.home,
            date: match.date,
            time: match.time,
            meetTime: match.meetTime,
            venue: match.venue,
            address: match.address,
            notes: match.notes,
          }}
        />
      </div>
    </main>
  );
}
