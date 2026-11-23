// One game, as a family sees it: the game, whether each of their children can
// come (the one thing they're asked), then when, where and the coaches'
// message. Nothing else — no line-ups, and no one else's answers. Coaches
// manage games in Coach Admin → Fixtures, so they're sent there.
import { notFound, redirect } from "next/navigation";
import { TopBar } from "../../components/SettingsUI";
import { getMatch } from "@/lib/matchStorage";
import { getClub } from "@/lib/settings";
import { deadlinePassed, invitedOf, myPlayersIn, readReplies, squadOf } from "@/lib/fixtures";
import { fixtureTeamName, gameTitle, ukToday } from "@/lib/fixtureFormat";
import { fixturesViewer } from "../viewer";
import ChildReplies from "../ChildReplies";
import { CalledOff, GameDetails, GameHero } from "../GameParts";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `Game – ${(await getClub()).name}` };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await fixturesViewer(`/fixtures/${id}`);
  if (v.coach) redirect(`/admin/fixtures/${id}`);
  const match = await getMatch(id).catch(() => null);
  if (!match) notFound();
  if (!v.visible.includes(match.team)) redirect("/fixtures");

  const team = v.teams.find((t) => t.slug === match.team)!;
  // written like the opposition: "Pudsey Juniors U10 Greens"
  const ourName = fixtureTeamName((await getClub()).name, team);
  const today = ukToday();
  const [squad, replies] = await Promise.all([
    squadOf(match.team).catch(() => []),
    readReplies(match.id).catch(() => ({ players: {}, hosts: {} }) as Awaited<ReturnType<typeof readReplies>>),
  ]);
  const kids = myPlayersIn(v.person, invitedOf(squad, match));
  const over = (match.resultLogged && !match.calledOff) || match.date < today;
  const closed = deadlinePassed(match);
  const open = !over && match.calledOff !== "cancelled" && !closed;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-28 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title={gameTitle(match)} href="/fixtures" />
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4">
        <GameHero match={match} teamName={ourName} today={today} />
        <CalledOff match={match} />

        {/* the one thing a family is asked */}
        {!over && match.calledOff !== "cancelled" && (
          <ChildReplies matchId={match.id} kids={kids} replies={replies.players} open={open} deadline={match.deadline} closed={closed} />
        )}

        <GameDetails match={match} teamName={ourName} />
      </div>
    </main>
  );
}
