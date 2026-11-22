// A coach changing a game, through the same steps as setting one up.
import { notFound } from "next/navigation";
import NoTabBar from "../../../../components/NoTabBar";
import { TopBar } from "../../../../components/SettingsUI";
import { getMatch, listMatches } from "@/lib/matchStorage";
import { getClub } from "@/lib/settings";
import { coachViewer, wizardData } from "../../load";
import FixtureWizard from "../../FixtureWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `Edit game – ${(await getClub()).name}` };
}

export default async function EditGame({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
  const v = await coachViewer(`/admin/fixtures/${id}/edit`);
  const match = await getMatch(id).catch(() => null);
  if (!match) notFound();
  const { teams, venues } = await wizardData(v.teams);
  const later = match.seriesId
    ? (await listMatches().catch(() => [])).filter((g) => g.seriesId === match.seriesId && g.id !== match.id && g.date > match.date && !g.resultLogged).length
    : 0;
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
      <NoTabBar />
      <TopBar title="Edit game" href={`/admin/fixtures/${id}`} />
      <div className="mx-auto max-w-xl px-4">
        <FixtureWizard
          matchId={match.id}
          sent={!!match.sentAt}
          startAt={step === "when" || step === "who" ? step : undefined}
          teams={teams}
          venues={venues}
          initial={{
            team: match.team,
            type: match.kind === "tournament" ? "tournament" : match.kind === "training" ? "training" : match.home ? "home" : "away",
            competition: match.cup ? "cup" : match.friendly ? "friendly" : "league",
            opponent: match.opponent,
            date: match.date,
            time: match.time,
            meetTime: match.meetTime,
            venue: match.venue,
            address: match.address,
            notes: match.notes,
            invited: match.invited,
            deadline: match.deadline,
            ourKit: match.ourKit,
            theirKit: match.theirKit,
            repeat: { every: 0, times: 1 },
          }}
          inSeries={later}
        />
      </div>
    </main>
  );
}
