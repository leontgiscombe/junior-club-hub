// A coach setting up a game, step by step (FixtureWizard).
import NoTabBar from "../../../components/NoTabBar";
import { TopBar } from "../../../components/SettingsUI";
import { getClub } from "@/lib/settings";
import { coachViewer, wizardData } from "../load";
import FixtureWizard from "../FixtureWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `New game – ${(await getClub()).name}` };
}

export default async function NewGame({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const v = await coachViewer("/admin/fixtures/new");
  const q = await searchParams;
  const { teams, venues } = await wizardData(v.teams);
  const own = v.person.team?.slug;
  const team = teams.some((t) => t.slug === q.team) ? q.team! : teams.length === 1 ? teams[0].slug : own && teams.some((t) => t.slug === own) ? own : "";
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
      <NoTabBar />
      <TopBar title="New game" href="/admin/fixtures" />
      <div className="mx-auto max-w-xl px-4">
        <FixtureWizard
          teams={teams}
          venues={venues}
          initial={{ team, type: "home", competition: "league", opponent: "", date: "", time: "", meetTime: "", venue: "", address: "", notes: "", invited: null, deadline: "" }}
        />
      </div>
    </main>
  );
}
