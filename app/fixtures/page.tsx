// Fixtures, for families: their teams' coming games and results, with a
// "Reply" on any game still waiting for their answer. Each game opens its own
// page (app/fixtures/[id]). Coaches use Coach Admin → Fixtures instead.
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "../components/SettingsUI";
import { listMatches, type Match } from "@/lib/matchStorage";
import { outcome } from "@/lib/record";
import { getClub } from "@/lib/settings";
import { invitedOf, myPlayersIn, readRepliesFor, squadOf } from "@/lib/fixtures";
import { dayWords, gameTitle, kindLabel, relativeDay, ukToday } from "@/lib/fixtureFormat";
import type { Player } from "@/lib/statsStorage";
import { fixturesViewer } from "./viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Fixtures – ${club.name}` };
}

const card = "rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
const sub = "text-gray-500 dark:text-gray-400";

const RESULT = {
  W: { label: "Won", badge: "bg-green-600" },
  D: { label: "Drew", badge: "bg-amber-500" },
  L: { label: "Lost", badge: "bg-red-600" },
} as const;

export default async function FixturesPage({ searchParams }: { searchParams: Promise<{ team?: string; view?: string }> }) {
  const v = await fixturesViewer("/fixtures");
  if (v.coach) redirect("/admin/fixtures");
  const q = await searchParams;
  const view = q.view === "results" ? "results" : "upcoming";
  // the team picked, else a coach's own, else everything they can see
  const team = v.visible.includes(q.team ?? "") ? q.team! : "";
  const shownTeams = team ? [team] : v.visible;
  const many = shownTeams.length > 1;
  const teamName = (slug: string) => v.teams.find((t) => t.slug === slug)?.name ?? "";
  const today = ukToday();

  const all = (await listMatches().catch(() => [] as Match[])).filter((m) => shownTeams.includes(m.team));
  const games =
    view === "upcoming"
      ? all.filter((m) => !m.resultLogged && m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      : all.filter((m) => m.resultLogged && !m.calledOff).sort((a, b) => b.date.localeCompare(a.date));

  // the answers so far, for coming games: each squad, once
  const squads = new Map<string, Player[]>();
  const replies = view === "upcoming" ? await readRepliesFor(games.map((m) => m.id)).catch(() => ({})) : {};
  if (view === "upcoming") {
    for (const slug of new Set(games.map((m) => m.team))) squads.set(slug, await squadOf(slug).catch(() => []));
  }

  const link = (p: { team?: string; view?: string }) => {
    const params = new URLSearchParams();
    const t = p.team ?? team;
    const vw = p.view ?? view;
    if (t) params.set("team", t);
    if (vw === "results") params.set("view", "results");
    const s = params.toString();
    return `/fixtures${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
      on ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white text-gray-700 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-200"
    }`;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-16 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title="Fixtures" href="/" />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4">
        {/* which games: coming up or results */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-200/70 p-1 dark:bg-white/10" role="tablist" aria-label="Fixtures or results">
          {(["upcoming", "results"] as const).map((id) => (
            <Link
              key={id}
              href={link({ view: id })}
              role="tab"
              aria-selected={view === id}
              className={`rounded-xl py-2 text-center text-sm font-bold ${view === id ? "bg-white shadow-sm dark:bg-[#2c2c2e]" : "text-gray-600 dark:text-gray-300"}`}
            >
              {id === "upcoming" ? "Coming up" : "Results"}
            </Link>
          ))}
        </div>

        {v.visible.length > 1 && (
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Teams">
            <Link href={link({ team: "" })} className={chip(!team)}>All teams</Link>
            {v.visible.map((slug) => (
              <Link key={slug} href={link({ team: slug })} className={chip(team === slug)}>
                {teamName(slug)}
              </Link>
            ))}
          </nav>
        )}

        {games.length === 0 ? (
          <div className={`${card} px-6 py-10 text-center`}>
            <p className="font-semibold">{view === "upcoming" ? "No games coming up" : "No results yet"}</p>
            <p className={`mt-1 text-sm ${sub}`}>
              {view === "upcoming" ? "They'll show here once the coaches have arranged them." : "Scores show here once the coaches have put them in."}
            </p>
          </div>
        ) : (
          <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
            {games.map((m) => {
              const squad = squads.get(m.team) ?? [];
              const r = (replies as Record<string, { players: Record<string, unknown> }>)[m.id];
              const kids = view === "upcoming" ? myPlayersIn(v.person, invitedOf(squad, m)) : [];
              const toAnswer = r && !m.calledOff ? kids.filter((k) => !r.players[k.playerId]).length : 0;
              return (
                <Link key={m.id} href={`/fixtures/${m.id}`} className="press flex items-center gap-3.5 px-4 py-3.5">
                  {view === "results" ? (
                    <span className={`grid h-12 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-lg font-extrabold text-white ${RESULT[outcome(m)].badge}`}>
                      {m.goals.length}–{m.opponentGoals}
                    </span>
                  ) : (
                    <span className="w-12 shrink-0 rounded-xl bg-green-50 py-1.5 text-center dark:bg-green-400/10">
                      <span className="block text-[11px] font-bold uppercase text-green-700 dark:text-green-400">{dayWords(m.date, { month: "short" })}</span>
                      <span className="block text-xl font-extrabold leading-tight">{dayWords(m.date, { day: "numeric" })}</span>
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {many ? `${teamName(m.team)} · ` : ""}
                      {gameTitle(m)}
                    </span>
                    <span className={`block truncate text-sm ${sub}`}>
                      {m.calledOff && (
                        <span className="font-bold text-red-600 dark:text-red-400">{m.calledOff === "postponed" ? "Postponed" : "Cancelled"} · </span>
                      )}
                      {view === "results"
                        ? `${RESULT[outcome(m)].label} · ${dayWords(m.date, { weekday: "short", day: "numeric", month: "short" })}`
                        : `${relativeDay(m.date, today)}${m.time && !m.calledOff ? ` · ${m.time}` : ""} · ${kindLabel(m).split(" · ")[0]}`}
                    </span>
                  </span>
                  {/* a parent: whether they still have to answer; a coach: how the squad's answered */}
                  {view === "upcoming" && !m.calledOff && kids.length > 0 && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        toAnswer ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300"
                      }`}
                    >
                      {toAnswer ? "Reply" : "Replied"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
