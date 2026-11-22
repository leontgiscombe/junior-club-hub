// One game, for its team's families and the coaches:
//   everyone:  who it's against, when to meet and kick off, where (with a map
//              and directions in Apple Maps), the coaches' notes, and the
//              score once it's in;
//   parents:   whether each of their children can play;
//   coaches:   whether they can host it, every player's answer (playing,
//              can't play, not answered yet), the other coaches' answers,
//              sending it to the families and reminding them, the result, and
//              a line-up only coaches ever see.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "../../components/SettingsUI";
import { getMatch } from "@/lib/matchStorage";
import { listPeople } from "@/lib/people";
import { outcome } from "@/lib/record";
import { getClub } from "@/lib/settings";
import { FORMATIONS, teamFormat, teamFormation } from "@/lib/clubSettings";
import { familiesOf, hostsOf, lineupSlots, myPlayersIn, readReplies, squadOf, tally, type Reply } from "@/lib/fixtures";
import { dayWords, relativeDay, ukToday } from "@/lib/fixtureFormat";
import { fixturesViewer } from "../viewer";
import { CoachActions, LineupEditor, ReplyToggle, ScoreEditor } from "../FixtureControls";
import VenueMap from "../VenueMap";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Fixture – ${club.name}` };
}

const card = "rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
const sub = "text-gray-500 dark:text-gray-400";
const heading = "px-1 text-[13px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

function Avatar({ name, tone = "gray" }: { name: string; tone?: "green" | "gray" | "dark" }) {
  const colours = {
    green: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
    dark: "bg-gray-200 text-gray-700 dark:bg-white/15 dark:text-gray-200",
  };
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${colours[tone]}`}>{initials(name) || "?"}</span>;
}

function TimeRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className={`flex-1 text-sm ${sub}`}>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

const RESULT = {
  W: { label: "Won", tone: "bg-green-600" },
  D: { label: "Drew", tone: "bg-amber-500" },
  L: { label: "Lost", tone: "bg-red-600" },
} as const;

export default async function FixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await fixturesViewer(`/fixtures/${id}`);
  const match = await getMatch(id).catch(() => null);
  if (!match) notFound();
  if (!v.visible.includes(match.team)) redirect("/fixtures");

  const team = v.teams.find((t) => t.slug === match.team)!;
  const today = ukToday();
  const [squad, replies, people] = await Promise.all([
    squadOf(match.team).catch(() => []),
    readReplies(match.id).catch(() => ({ players: {}, hosts: {} }) as Awaited<ReturnType<typeof readReplies>>),
    v.coach ? listPeople(v.tenant).catch(() => []) : Promise.resolve([]),
  ]);
  const kids = myPlayersIn(v.person, squad);
  const played = match.resultLogged && !match.calledOff;
  const over = played || match.date < today;
  const open = !over && match.calledOff !== "cancelled";
  const kind = match.cup ? "Cup" : match.friendly ? "Friendly" : "League";

  // ---- the coaches' view of everyone's answers ----
  const t = tally(squad, replies);
  const going = squad.filter((p) => replies.players[p.id]?.answer === "yes");
  const notGoing = squad.filter((p) => replies.players[p.id]?.answer === "no");
  const waiting = squad.filter((p) => !replies.players[p.id]);
  const hosts = v.coach ? hostsOf(people, match.team) : [];
  // coaches who've answered without being one of the team's, too
  const hostIds = new Set(hosts.map((h) => h.userId));
  const otherHosts = v.coach ? people.filter((p) => !hostIds.has(p.userId) && replies.hosts[p.userId]) : [];
  const families = v.coach ? familiesOf(people, match.team) : [];
  const waitingFamilies = families.filter((f) => myPlayersIn(f, squad).some((c) => !replies.players[c.playerId])).length;

  const shapes = [...FORMATIONS[teamFormat(team)]];
  const formation = match.lineup && shapes.includes(match.lineup.formation) ? match.lineup.formation : teamFormation(team);
  const slotsFor = Object.fromEntries(shapes.map((f) => [f, lineupSlots(f)]));

  const notes = match.notes.trim();
  const longNotes = notes.length > 220 || notes.split("\n").length > 4;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-16 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title={`vs ${match.opponent}`} href="/fixtures" />
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4">
        {/* the game itself: a scoreboard */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-green-700 to-emerald-900 text-white shadow-sm">
          <div className="flex items-center justify-between px-5 pt-4 text-xs font-bold uppercase tracking-wider text-white/75">
            <span>{kind}</span>
            <span>{match.home ? "Home" : "Away"}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pb-5 pt-3">
            <span className="text-left text-lg font-extrabold leading-tight">{match.home ? team.name : match.opponent}</span>
            {played ? (
              <span className="rounded-2xl bg-white/15 px-3 py-1.5 text-3xl font-black tabular-nums">
                {match.home ? match.goals.length : match.opponentGoals}–{match.home ? match.opponentGoals : match.goals.length}
              </span>
            ) : (
              <span className="rounded-2xl bg-white/15 px-3 py-2 text-center text-sm font-black">{match.time || "TBC"}</span>
            )}
            <span className="text-right text-lg font-extrabold leading-tight">{match.home ? match.opponent : team.name}</span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-black/15 px-5 py-2.5 text-sm font-semibold">
            <span>{relativeDay(match.date, today)}</span>
            {played && <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${RESULT[outcome(match)].tone}`}>{RESULT[outcome(match)].label}</span>}
            {!played && match.date < today && !match.calledOff && <span className="text-white/75">Result to come</span>}
          </div>
        </section>

        {match.calledOff && (
          <div className="rounded-3xl bg-red-50 px-4 py-3.5 text-red-800 dark:bg-red-400/10 dark:text-red-300">
            <p className="font-bold">{match.calledOff === "postponed" ? "This game has been postponed" : "This game has been cancelled"}</p>
            <p className="text-sm opacity-80">{match.calledOff === "postponed" ? "It'll show here again once it has a new date." : "There's nothing to get to."}</p>
          </div>
        )}

        {/* when */}
        <section className="flex flex-col gap-2">
          <h2 className={heading}>When</h2>
          <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
            <TimeRow label="Date" value={dayWords(match.date, { weekday: "short", day: "numeric", month: "short" })} icon={<><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>} />
            {match.meetTime && <TimeRow label="Meet" value={match.meetTime} icon={<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4 4 0 0 1 7 0" /></>} />}
            <TimeRow label="Kick-off" value={match.time || "TBC"} icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
          </div>
        </section>

        {/* where */}
        {(match.venue || match.address) && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>Where</h2>
            <div className={`${card} overflow-hidden`}>
              <VenueMap venue={match.venue} address={match.address} label={`${team.name} vs ${match.opponent}`} />
            </div>
          </section>
        )}

        {/* the coaches' notes */}
        {notes && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>From the coaches</h2>
            <div className={`${card} px-4 py-3.5`}>
              {longNotes ? (
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <p className="line-clamp-4 whitespace-pre-line text-[15px] group-open:hidden">{notes}</p>
                    <span className="mt-1 inline-block text-sm font-bold text-green-700 group-open:hidden dark:text-green-400">Show all</span>
                  </summary>
                  <p className="whitespace-pre-line text-[15px]">{notes}</p>
                </details>
              ) : (
                <p className="whitespace-pre-line text-[15px]">{notes}</p>
              )}
            </div>
          </section>
        )}

        {/* a parent: can each child play? */}
        {kids.length > 0 && (open || kids.some((k) => replies.players[k.playerId])) && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>{kids.length > 1 ? "Can they play?" : `Can ${kids[0].name.split(/\s+/)[0]} play?`}</h2>
            <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
              {kids.map((k) => {
                const r = replies.players[k.playerId];
                return (
                  <div key={k.playerId} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <Avatar name={k.name} tone={r?.answer === "yes" ? "green" : "gray"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{k.name.split(/\s+/)[0]}</span>
                      <span className={`block text-xs ${sub}`}>
                        {r ? `${r.answer === "yes" ? "Playing" : "Not playing"}${r.byUserId !== v.person.userId ? ` · answered by ${r.by}` : ""}` : open ? "Waiting for your answer" : "No answer"}
                      </span>
                    </span>
                    {open ? (
                      <ReplyToggle wide matchId={match.id} playerId={k.playerId} initial={r?.answer ?? null} initialNote={r?.note ?? ""} />
                    ) : null}
                  </div>
                );
              })}
            </div>
            {!match.sentAt && open && <p className={`px-1 text-xs ${sub}`}>The coaches haven&apos;t asked yet, but you can answer now.</p>}
          </section>
        )}

        {/* a coach: hosting it themselves */}
        {v.coach && open && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>Your availability</h2>
            <div className={`${card} flex items-center gap-3 px-4 py-3.5`}>
              <Avatar name={v.person.name} tone={replies.hosts[v.person.userId]?.answer === "yes" ? "green" : "gray"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">You</span>
                <span className={`block text-xs ${sub}`}>Coaching this game</span>
              </span>
              <ReplyToggle matchId={match.id} host initial={replies.hosts[v.person.userId]?.answer ?? null} labels={["I'm in", "Can't"]} />
            </div>
          </section>
        )}

        {/* a coach: sending, reminding, editing */}
        {v.coach && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>Manage</h2>
            {match.sentAt ? (
              <p className={`px-1 text-sm ${sub}`}>
                Sent to families {dayWords(match.sentAt.slice(0, 10), { day: "numeric", month: "short" })}.
                {waitingFamilies ? ` ${waitingFamilies} still to reply.` : " Every family has replied."}
              </p>
            ) : (
              <p className={`px-1 text-sm ${sub}`}>Not sent yet. Sending asks each family whether their child can play.</p>
            )}
            <CoachActions matchId={match.id} sent={!!match.sentAt} waitingFamilies={open ? waitingFamilies : 0} calledOff={match.calledOff} canCallOff={!played && !over} />
          </section>
        )}

        {/* a coach: everyone's answers */}
        {v.coach && squad.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>Squad replies</h2>
            <div className={`${card} overflow-hidden`}>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center dark:divide-white/10 dark:border-white/10">
                {[
                  { n: t.yes, label: "Playing", tone: "text-green-700 dark:text-green-400" },
                  { n: t.no, label: "Can't play", tone: "text-gray-900 dark:text-gray-50" },
                  { n: t.waiting, label: "No reply", tone: "text-amber-600 dark:text-amber-400" },
                ].map((x) => (
                  <div key={x.label} className="py-3">
                    <span className={`block text-2xl font-black tabular-nums ${x.tone}`}>{x.n}</span>
                    <span className={`block text-xs font-semibold ${sub}`}>{x.label}</span>
                  </div>
                ))}
              </div>
              {/* the three as one bar */}
              <div className="flex h-1.5 w-full" aria-hidden="true">
                <span className="bg-green-600" style={{ width: `${(t.yes / squad.length) * 100}%` }} />
                <span className="bg-gray-700 dark:bg-gray-300" style={{ width: `${(t.no / squad.length) * 100}%` }} />
                <span className="bg-amber-400" style={{ width: `${(t.waiting / squad.length) * 100}%` }} />
              </div>
              {[
                { title: "Playing", list: going, tone: "green" as const },
                { title: "Can't play", list: notGoing, tone: "dark" as const },
                { title: "No reply yet", list: waiting, tone: "gray" as const },
              ]
                .filter((g) => g.list.length)
                .map((g) => (
                  <details key={g.title} open={g.title !== "Playing" || waiting.length === 0} className="group border-t border-gray-100 dark:border-white/10">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold">
                      <span>
                        {g.title} <span className={sub}>({g.list.length})</span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </summary>
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                      {g.list.map((p) => {
                        const r: Reply | undefined = replies.players[p.id];
                        return (
                          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Avatar name={p.name} tone={g.tone} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                              {r && (
                                <span className={`block truncate text-xs ${sub}`}>
                                  {r.note ? `“${r.note}” · ` : ""}
                                  {r.by}
                                </span>
                              )}
                            </span>
                            {open && <ReplyToggle compact matchId={match.id} playerId={p.id} initial={r?.answer ?? null} />}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ))}
            </div>
            <p className={`px-1 text-xs ${sub}`}>Only coaches see this list. Use the tick or cross to answer for a family who told you another way.</p>
          </section>
        )}

        {/* a coach: the other coaches */}
        {v.coach && hosts.length + otherHosts.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>Coaches</h2>
            <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
              {[...hosts, ...otherHosts].map((h) => {
                const r = replies.hosts[h.userId];
                return (
                  <div key={h.userId} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={h.name} tone={r?.answer === "yes" ? "green" : r ? "dark" : "gray"} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                      {h.name}
                      {h.userId === v.person.userId ? " (you)" : ""}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        r?.answer === "yes"
                          ? "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300"
                          : r
                            ? "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
                      }`}
                    >
                      {r?.answer === "yes" ? "Available" : r ? "Unavailable" : "No reply"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* a coach: the result, once the game's on or past */}
        {v.coach && !match.calledOff && match.date <= today && (
          <section className="flex flex-col gap-2">
            <h2 className={heading}>Result</h2>
            <div className={`${card} p-4`}>
              <ScoreEditor matchId={match.id} us={match.goals.length} them={match.opponentGoals} logged={match.resultLogged} teamName={team.name} opponent={match.opponent} />
            </div>
          </section>
        )}

        {/* a coach: the line-up, for coaches' eyes only */}
        {v.coach && squad.length > 0 && !match.calledOff && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className={heading.replace("px-1 ", "")}>Line-up</h2>
              <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Coaches only
              </span>
            </div>
            <div className={`${card} p-4`}>
              <LineupEditor
                matchId={match.id}
                formations={shapes}
                initialFormation={formation}
                initialSlots={match.lineup?.formation === formation ? match.lineup.slots : []}
                slotsFor={slotsFor}
                squad={squad.map((p) => ({ id: p.id, name: p.name, answer: replies.players[p.id]?.answer ?? null }))}
              />
            </div>
          </section>
        )}

        {v.coach && (
          <Link href="/admin/stats/matches" className={`press ${card} flex items-center justify-between px-4 py-3.5 text-sm font-bold`}>
            <span>Scorers, awards and appearances in the Match Log</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </main>
  );
}
