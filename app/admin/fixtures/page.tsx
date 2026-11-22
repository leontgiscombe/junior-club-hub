// Coach Admin → Fixtures: each team's games, to set up, send to the families
// and follow up. Each row says whether it's been sent and how many of the
// invited players have answered; a game opens on its own page.
import Link from "next/link";
import { TopBar } from "../../components/SettingsUI";
import { listMatches, type Match } from "@/lib/matchStorage";
import { outcome } from "@/lib/record";
import { getClub } from "@/lib/settings";
import { invitedOf, readRepliesFor, squadOf, tally } from "@/lib/fixtures";
import { dayWords, gameTitle, kindLabel, relativeDay, ukToday } from "@/lib/fixtureFormat";
import type { Player } from "@/lib/statsStorage";
import { coachViewer } from "./load";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `Fixtures – ${(await getClub()).name}` };
}

const card = "rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
const sub = "text-gray-500 dark:text-gray-400";
const RESULT = { W: "bg-green-600", D: "bg-amber-500", L: "bg-red-600" } as const;

export default async function CoachFixtures({ searchParams }: { searchParams: Promise<{ team?: string; view?: string }> }) {
  const v = await coachViewer("/admin/fixtures");
  const q = await searchParams;
  const view = q.view === "results" ? "results" : "upcoming";
  const own = v.person.team?.slug;
  // a coach starts on their own team
  const team = q.team === "all" ? "" : v.visible.includes(q.team ?? "") ? q.team! : own && v.visible.includes(own) ? own : "";
  const shown = team ? [team] : v.visible;
  const teamName = (slug: string) => v.teams.find((t) => t.slug === slug)?.name ?? "";
  const today = ukToday();

  const all = (await listMatches().catch(() => [] as Match[])).filter((m) => shown.includes(m.team));
  const games =
    view === "upcoming"
      ? all.filter((m) => !m.resultLogged && m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      : all.filter((m) => (m.resultLogged || m.date < today) && !m.calledOff).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const replies = view === "upcoming" ? await readRepliesFor(games.map((m) => m.id)).catch(() => ({})) : {};
  const squads = new Map<string, Player[]>();
  for (const slug of new Set(games.map((m) => m.team))) squads.set(slug, await squadOf(slug).catch(() => []));

  const link = (p: { team?: string; view?: string }) => {
    const params = new URLSearchParams();
    const t = p.team ?? (team || (q.team === "all" ? "all" : ""));
    if (t) params.set("team", t);
    if ((p.view ?? view) === "results") params.set("view", "results");
    const s = params.toString();
    return `/admin/fixtures${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white text-gray-700 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-200"}`;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-28 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title="Fixtures" href="/admin" />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4">
        <Link href={`/admin/fixtures/new${team ? `?team=${encodeURIComponent(team)}` : ""}`} className="press flex items-center justify-center gap-2 rounded-2xl bg-green-700 py-3.5 font-bold text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New game
        </Link>

        {v.visible.length > 1 && (
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Teams">
            <Link href={link({ team: "all" })} className={chip(!team)}>All teams</Link>
            {v.visible.map((slug) => (
              <Link key={slug} href={link({ team: slug })} className={chip(team === slug)}>
                {teamName(slug)}
              </Link>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-200/70 p-1 dark:bg-white/10" role="tablist" aria-label="Coming up or played">
          {(["upcoming", "results"] as const).map((id) => (
            <Link key={id} href={link({ view: id })} role="tab" aria-selected={view === id} className={`rounded-xl py-2 text-center text-sm font-bold ${view === id ? "bg-white shadow-sm dark:bg-[#2c2c2e]" : "text-gray-600 dark:text-gray-300"}`}>
              {id === "upcoming" ? "Coming up" : "Played"}
            </Link>
          ))}
        </div>

        {games.length === 0 ? (
          <div className={`${card} px-6 py-10 text-center`}>
            <p className="font-semibold">{view === "upcoming" ? "No games coming up" : "No games played yet"}</p>
            <p className={`mt-1 text-sm ${sub}`}>{view === "upcoming" ? "Tap New game to set one up and send it to the families." : "Played games show here."}</p>
          </div>
        ) : (
          <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
            {games.map((m) => {
              const invited = invitedOf(squads.get(m.team) ?? [], m);
              const r = (replies as Record<string, Parameters<typeof tally>[1]>)[m.id];
              const t = r ? tally(invited, r) : null;
              return (
                <Link key={m.id} href={`/admin/fixtures/${m.id}`} className="press flex items-center gap-3.5 px-4 py-3.5">
                  {m.resultLogged && !m.calledOff ? (
                    <span className={`grid h-12 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-lg font-extrabold text-white ${RESULT[outcome(m)]}`}>
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
                      {!team && shown.length > 1 ? `${teamName(m.team)} · ` : ""}
                      {gameTitle(m)}
                    </span>
                    <span className={`block truncate text-sm ${sub}`}>
                      {m.calledOff ? (
                        <span className="font-bold text-red-600 dark:text-red-400">{m.calledOff === "postponed" ? "Postponed" : "Cancelled"}</span>
                      ) : (
                        `${view === "upcoming" ? relativeDay(m.date, today) : dayWords(m.date, { weekday: "short", day: "numeric", month: "short" })}${m.time ? ` · ${m.time}` : ""} · ${kindLabel(m)}`
                      )}
                    </span>
                  </span>
                  {view === "upcoming" && !m.calledOff && (
                    !m.sentAt ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">Not sent</span>
                    ) : t ? (
                      <span className="shrink-0 text-right text-xs font-semibold tabular-nums">
                        <span className="block text-green-700 dark:text-green-400">{t.yes} coming</span>
                        <span className={`block ${sub}`}>{t.waiting ? `${t.waiting} to reply` : "All replied"}</span>
                      </span>
                    ) : null
                  )}
                </Link>
              );
            })}
          </div>
        )}
        <p className={`px-1 text-xs ${sub}`}>Scorers, assists and awards are still logged in the Match Log.</p>
      </div>
    </main>
  );
}
