// One game, for a coach, in three tabs:
//   Overview    the game, sending it or reminding the families, the coach's
//               own availability, the result, and when and where
//   Attendance  who's coming, who can't, and who hasn't answered; the coaches
//   Line-up     a line-up only coaches ever see
// Editing, postponing, cancelling and removing are tucked under More.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "../../../components/SettingsUI";
import { getMatch, listMatches } from "@/lib/matchStorage";
import { listPeople } from "@/lib/people";
import { getClub } from "@/lib/settings";
import { FORMATIONS, teamFormat, teamFormation } from "@/lib/clubSettings";
import { deadlinePassed, familiesOf, hostsFor, invitedOf, lineupSlots, myPlayersIn, readReplies, squadOf, tally, type Reply } from "@/lib/fixtures";
import { dayWords, deadlineWords, gameTitle, ukToday } from "@/lib/fixtureFormat";
import { LineupEditor, MoreActions, ReplyToggle, ScoreEditor, SendButton } from "../../../fixtures/FixtureControls";
import { Avatar, CalledOff, GameDetails, GameHero, card, heading, sub } from "../../../fixtures/GameParts";
import { coachViewer } from "../load";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `Game – ${(await getClub()).name}` };
}

type Tab = "overview" | "attendance" | "lineup";

export default async function CoachGame({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tab: Tab = ((t) => (t === "attendance" || t === "lineup" ? t : "overview"))((await searchParams).tab);
  const v = await coachViewer(`/admin/fixtures/${id}`);
  const match = await getMatch(id).catch(() => null);
  if (!match) notFound();
  if (!v.visible.includes(match.team)) redirect("/admin/fixtures");

  const team = v.teams.find((t) => t.slug === match.team)!;
  const today = ukToday();
  const [squad, replies, people] = await Promise.all([
    squadOf(match.team).catch(() => []),
    readReplies(match.id).catch(() => ({ players: {}, hosts: {} }) as Awaited<ReturnType<typeof readReplies>>),
    listPeople(v.tenant).catch(() => []),
  ]);
  const invited = invitedOf(squad, match);
  const t = tally(invited, replies);
  const played = match.resultLogged && !match.calledOff;
  const over = played || match.date < today;
  const open = !over && match.calledOff !== "cancelled";
  const families = familiesOf(people, match.team).filter((f) => myPlayersIn(f, invited).length > 0);
  const waitingFamilies = families.filter((f) => myPlayersIn(f, invited).some((c) => !replies.players[c.playerId])).length;
  const me = replies.hosts[v.person.userId];
  // the games after this one in a repeating series, not yet played
  const series = match.seriesId ? (await listMatches().catch(() => [])).filter((g) => g.seriesId === match.seriesId).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const laterInSeries = series.filter((g) => g.date > match.date && !g.resultLogged).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "attendance", label: `Attendance${invited.length ? ` ${t.yes}/${invited.length}` : ""}` },
    ...(!match.calledOff ? [{ id: "lineup" as const, label: "Line-up" }] : []),
  ];

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-28 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title={gameTitle(match)} href="/admin/fixtures" />
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4">
        <div className="grid gap-1 rounded-2xl bg-gray-200/70 p-1 dark:bg-white/10" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} role="tablist">
          {tabs.map((x) => (
            <Link
              key={x.id}
              href={`/admin/fixtures/${match.id}${x.id === "overview" ? "" : `?tab=${x.id}`}`}
              replace
              role="tab"
              aria-selected={tab === x.id}
              className={`rounded-xl py-2 text-center text-sm font-bold ${tab === x.id ? "bg-white shadow-sm dark:bg-[#2c2c2e]" : "text-gray-600 dark:text-gray-300"}`}
            >
              {x.label}
            </Link>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <GameHero match={match} teamName={team.name} today={today} />
            <CalledOff match={match} />
            {series.length > 1 && (
              <p className={`-mt-2 px-1 text-sm ${sub}`}>
                Game {series.findIndex((g) => g.id === match.id) + 1} of {series.length} in a repeating series
              </p>
            )}

            {/* a game from FA Full-Time: what it still needs before it goes to families */}
            {open && match.faId && !match.sentAt && (!match.venue || !match.meetTime) && (
              <Link href={`/admin/fixtures/${match.id}/edit?step=when`} className="press flex items-center gap-3 rounded-3xl bg-sky-50 px-4 py-3.5 text-sky-900 dark:bg-sky-400/10 dark:text-sky-200">
                <span className="rounded-md bg-sky-200/70 px-1.5 py-0.5 text-xs font-extrabold dark:bg-sky-400/20">FA</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">From FA Full-Time</span>
                  <span className="block text-sm opacity-80">
                    Add {[!match.venue && "the ground", !match.meetTime && "the meet time"].filter(Boolean).join(" and ")} before sending
                  </span>
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            {/* sending it, and how it's going */}
            {open && (
              <section className={`${card} flex flex-col gap-3 p-4`}>
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!match.sentAt ? "bg-amber-500" : waitingFamilies ? "bg-green-500" : "bg-green-700"}`} aria-hidden="true" />
                  <span className="flex-1 text-[15px] font-semibold">
                    {!match.sentAt
                      ? "Not sent to families yet"
                      : `Sent ${dayWords(match.sentAt.slice(0, 10), { day: "numeric", month: "short" })} · ${t.yes} coming, ${t.waiting} to reply`}
                  </span>
                </div>
                {match.deadline && (
                  <p className={`text-sm ${sub}`}>
                    Reply by {deadlineWords(match.deadline)}
                    {deadlinePassed(match) ? " (passed)" : ""}
                  </p>
                )}
                <SendButton matchId={match.id} sent={!!match.sentAt} waitingFamilies={waitingFamilies} />
                {match.sentAt && (
                  <Link href={`/admin/fixtures/${match.id}?tab=attendance`} replace className="text-center text-sm font-bold text-green-700 dark:text-green-400">
                    See who&apos;s coming
                  </Link>
                )}
              </section>
            )}

            {/* the coach's own availability */}
            {open && (
              <section className={`${card} flex flex-wrap items-center gap-3 px-4 py-3.5`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Can you be there?</span>
                  <span className={`block text-xs ${sub}`}>{me ? (me.answer === "yes" ? "You're available" : "You're not available") : "Let the other coaches know"}</span>
                </span>
                <ReplyToggle matchId={match.id} host initial={me?.answer ?? null} labels={["Yes", "No"]} />
              </section>
            )}

            {/* the result, once the day comes (a tournament has no single score) */}
            {!match.calledOff && match.date <= today && match.kind !== "tournament" && (
              <section className="flex flex-col gap-2">
                <h2 className={heading}>Result</h2>
                <div className={`${card} p-4`}>
                  <ScoreEditor matchId={match.id} us={match.goals.length} them={match.opponentGoals} logged={match.resultLogged} teamName={team.name} opponent={match.opponent} />
                </div>
              </section>
            )}

            <GameDetails match={match} teamName={team.name} />

            <section className="flex flex-col gap-2">
              <h2 className={heading}>More</h2>
              <MoreActions matchId={match.id} calledOff={match.calledOff} canCallOff={!over} laterInSeries={laterInSeries} />
            </section>
          </>
        )}

        {tab === "attendance" && (
          <>
            {invited.length === 0 ? (
              <div className={`${card} px-6 py-10 text-center`}>
                <p className="font-semibold">No players in {team.name} yet</p>
                <p className={`mt-1 text-sm ${sub}`}>Add them in Coach Admin → Members.</p>
              </div>
            ) : (
              <section className={`${card} overflow-hidden`}>
                <div className="grid grid-cols-3 divide-x divide-gray-100 text-center dark:divide-white/10">
                  {[
                    { n: t.yes, label: "Coming", tone: "text-green-700 dark:text-green-400" },
                    { n: t.no, label: "Can't come", tone: "" },
                    { n: t.waiting, label: "No reply", tone: "text-amber-600 dark:text-amber-400" },
                  ].map((x) => (
                    <div key={x.label} className="py-3">
                      <span className={`block text-2xl font-black tabular-nums ${x.tone}`}>{x.n}</span>
                      <span className={`block text-xs font-semibold ${sub}`}>{x.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex h-1.5 w-full" aria-hidden="true">
                  <span className="bg-green-600" style={{ width: `${(t.yes / invited.length) * 100}%` }} />
                  <span className="bg-gray-600 dark:bg-gray-300" style={{ width: `${(t.no / invited.length) * 100}%` }} />
                  <span className="bg-amber-400" style={{ width: `${(t.waiting / invited.length) * 100}%` }} />
                </div>
              </section>
            )}

            {[
              { title: "No reply yet", list: invited.filter((p) => !replies.players[p.id]), tone: "gray" as const },
              { title: "Coming", list: invited.filter((p) => replies.players[p.id]?.answer === "yes"), tone: "green" as const },
              { title: "Can't come", list: invited.filter((p) => replies.players[p.id]?.answer === "no"), tone: "dark" as const },
            ]
              .filter((g) => g.list.length)
              .map((g) => (
                <section key={g.title} className="flex flex-col gap-2">
                  <h2 className={heading}>
                    {g.title} ({g.list.length})
                  </h2>
                  <ul className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
                    {g.list.map((p) => {
                      const r: Reply | undefined = replies.players[p.id];
                      return (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                          <Avatar name={p.name} tone={g.tone} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                            {r?.note && <span className={`block truncate text-xs ${sub}`}>“{r.note}”</span>}
                          </span>
                          {open && <ReplyToggle compact matchId={match.id} playerId={p.id} initial={r?.answer ?? null} />}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            {open && invited.length > 0 && <p className={`px-1 text-xs ${sub}`}>Use the tick or cross to answer for a family who told you another way.</p>}

            <CoachList people={people} match={match} hosts={replies.hosts} me={v.person.userId} />
          </>
        )}

        {tab === "lineup" && !match.calledOff && (
          <section className="flex flex-col gap-2">
            <p className={`flex items-center gap-1.5 px-1 text-sm ${sub}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Only coaches can see the line-up.
            </p>
            {invited.length ? (
              <div className={`${card} p-4`}>
                <Lineup match={match} team={team} invited={invited.map((p) => ({ id: p.id, name: p.name, answer: replies.players[p.id]?.answer ?? null }))} />
              </div>
            ) : (
              <div className={`${card} px-6 py-10 text-center text-sm ${sub}`}>No players to pick from yet.</div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Lineup({
  match,
  team,
  invited,
}: {
  match: NonNullable<Awaited<ReturnType<typeof getMatch>>>;
  team: Parameters<typeof teamFormat>[0] & Parameters<typeof teamFormation>[0];
  invited: { id: string; name: string; answer: "yes" | "no" | null }[];
}) {
  const shapes = [...FORMATIONS[teamFormat(team)]];
  const formation = match.lineup && shapes.includes(match.lineup.formation) ? match.lineup.formation : teamFormation(team);
  return (
    <LineupEditor
      matchId={match.id}
      formations={shapes}
      initialFormation={formation}
      initialSlots={match.lineup?.formation === formation ? match.lineup.slots : []}
      slotsFor={Object.fromEntries(shapes.map((f) => [f, lineupSlots(f)]))}
      squad={invited}
    />
  );
}

/** The coaches and whether they can be there. */
function CoachList({
  people,
  match,
  hosts,
  me,
}: {
  people: Awaited<ReturnType<typeof listPeople>>;
  match: Parameters<typeof hostsFor>[1];
  hosts: Record<string, Reply>;
  me: string;
}) {
  // the coaches asked to host it, then any other coach who's said either way
  const own = hostsFor(people, match);
  const ids = new Set(own.map((h) => h.userId));
  const list = [...own, ...people.filter((p) => !ids.has(p.userId) && hosts[p.userId])];
  if (!list.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={heading}>Coaches</h2>
      <ul className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
        {list.map((h) => {
          const r = hosts[h.userId];
          return (
            <li key={h.userId} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={h.name} tone={r?.answer === "yes" ? "green" : r ? "dark" : "gray"} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {h.name}
                {h.userId === me ? " (you)" : ""}
              </span>
              <span className={`text-sm font-semibold ${r?.answer === "yes" ? "text-green-700 dark:text-green-400" : r ? sub : "text-amber-600 dark:text-amber-400"}`}>
                {r?.answer === "yes" ? "Available" : r ? "Not available" : "No reply"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
