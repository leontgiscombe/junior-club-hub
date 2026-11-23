// One game, as a family sees it: the game, whether each of their children can
// come (the one thing they're asked), then when, where and the coaches'
// message. Nothing else — no line-ups, and no one else's answers. Coaches
// manage games in Coach Admin → Fixtures, so they're sent there.
import { notFound, redirect } from "next/navigation";
import { TopBar } from "../../components/SettingsUI";
import { getMatch } from "@/lib/matchStorage";
import { getClub } from "@/lib/settings";
import { deadlinePassed, invitedOf, myPlayersIn, readReplies, squadOf } from "@/lib/fixtures";
import { deadlineWords, fixtureTeamName, gameTitle, ukToday } from "@/lib/fixtureFormat";
import { fixturesViewer } from "../viewer";
import { ReplyToggle } from "../FixtureControls";
import { Avatar, CalledOff, GameDetails, GameHero, card, heading, sub } from "../GameParts";

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
  const first = (name: string) => name.split(/\s+/)[0];

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-28 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title={gameTitle(match)} href="/fixtures" />
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4">
        <GameHero match={match} teamName={ourName} today={today} />
        <CalledOff match={match} />

        {/* the one thing a family is asked */}
        {kids.length > 0 && !over && match.calledOff !== "cancelled" && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>{kids.length > 1 ? "Can they come?" : `Can ${first(kids[0].name)} come?`}</h2>
            <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
              {kids.map((k) => {
                const r = replies.players[k.playerId];
                return (
                  <div key={k.playerId} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <Avatar name={k.name} tone={r?.answer === "yes" ? "green" : "gray"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{first(k.name)}</span>
                      <span className={`block text-xs ${r ? sub : "font-semibold text-amber-600 dark:text-amber-400"}`}>
                        {r ? (r.answer === "yes" ? "Coming" : "Not coming") : "Please answer"}
                      </span>
                    </span>
                    {open && <ReplyToggle wide matchId={match.id} playerId={k.playerId} initial={r?.answer ?? null} initialNote={r?.note ?? ""} labels={["Coming", "Can't come"]} />}
                  </div>
                );
              })}
            </div>
            <p className={`px-1 text-xs ${sub}`}>
              {closed
                ? "The reply-by time has passed. Message the coaches if anything's changed."
                : match.deadline
                  ? `Please answer by ${deadlineWords(match.deadline)}.`
                  : "You can change your answer any time before the game."}
            </p>
          </section>
        )}

        <GameDetails match={match} teamName={ourName} />
      </div>
    </main>
  );
}
