// Public, read-only results for parents — no password.
//
// It reads storage directly rather than going through an API, so there is no
// public endpoint to widen by accident, and it only ever renders what is safe
// to show: scores, and players by name — shortened unless the club's hub is
// private (lib/names.ts). Nothing from the kit or camera side appears here.
import Link from "next/link";
import { TopBar } from "../components/SettingsUI";
import { redirect } from "next/navigation";
import { listPlayers, type Player } from "@/lib/statsStorage";
import { listMatches, type Match } from "@/lib/matchStorage";
import { getCurrentSeason } from "@/lib/season";
import { getClub, getTeams } from "@/lib/settings";
import { countsTowardsRecord, outcome, seasonRecord } from "@/lib/record";
import { cleanSheetCount } from "@/lib/cleanSheets";
import { shortName, showFullNames } from "@/lib/names";

// Always fresh — results change through the season.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Results – ${CLUB.name}`,
    description: `Results, tables and top scorers for ${CLUB.fullName}.`,
  };
}


/** Home's colours for a result: green won, amber drew, red lost. */
const BADGE = { W: "bg-green-600", D: "bg-amber-500", L: "bg-red-600" } as const;
const card = "rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";

function formatDate(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type PublicStat = "goals" | "assists" | "saves";

function topBy(players: Player[], field: PublicStat) {
  return players
    .filter((p) => (p[field] ?? 0) > 0)
    .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 5);
}

export default async function ResultsPage({
  searchParams,
}: {
  // ?team=<slug> narrows the page to one team, which also makes a link a
  // parent can be sent straight to their own team's results.
  searchParams: Promise<{ team?: string }>;
}) {
  // switched off on Coach Admin → Settings while the teams play non-competitively
  const [CLUB, TEAMS] = await Promise.all([getClub(), getTeams()]);
  if (!CLUB.publicResults) redirect("/");
  const { team: requested } = await searchParams;
  const selected = TEAMS.some((t) => t.slug === requested) ? requested : null;

  const [players, matches, season, fullNames] = await Promise.all([
    listPlayers(),
    listMatches(),
    getCurrentSeason(),
    showFullNames(),
  ]);

  const teams = TEAMS.map((team) => {
    const squad = players.filter((p) => p.team === team.slug);
    const played = matches
      .filter((m: Match) => m.team === team.slug && m.resultLogged)
      .sort((a, b) => b.date.localeCompare(a.date));
    const league = played.filter(countsTowardsRecord);
    return {
      ...team,
      record: seasonRecord(league),
      form: league.slice(0, 5).reverse().map(outcome),
      results: played.slice(0, 8),
      scorers: topBy(squad, "goals"),
      assisters: topBy(squad, "assists"),
      // Keepers earn their place on this page too — this card only appears
      // once someone has saves recorded.
      keepers: topBy(squad, "saves"),
      // A clean sheet is the team's, so it is counted in games alongside the
      // record rather than listed against players.
      cleanSheets: cleanSheetCount(played),
      // Every team with a squad or any fixtures is listed, even before its
      // first result — a missing team reads as broken rather than empty.
      nothingYet: played.length === 0 && !squad.some((p) => p.goals > 0),
    };
  });

  // Every team is listed, so a parent always finds theirs — a team yet to play
  // says so rather than going missing.
  const tabs = teams.map((t) => ({ slug: t.slug, name: t.name, accent: t.accent }));
  // One team at a time: the one asked for, else the first with results.
  const current =
    selected ?? (teams.find((t) => !t.nothingYet)?.slug ?? teams[0]?.slug ?? null);
  const shownTeams = teams.filter((t) => t.slug === current);

  return (
    <div className="themed flex min-h-screen flex-col bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      <TopBar title="Results" href="/" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8 pt-2">
        <p className="mb-4 text-center text-[15px] text-gray-500 dark:text-gray-400">{CLUB.name} · {season} season</p>
        {teams.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="mb-3 text-4xl">⚽</p>
            <p>No results yet this season — check back after the next game.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* the teams, as a switch like iOS's */}
            {tabs.length > 1 && (
              <div className="flex gap-1 rounded-full bg-gray-200/80 p-1 dark:bg-white/10">
                {tabs.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/results?team=${t.slug}`}
                    className={`min-w-0 flex-1 truncate rounded-full px-3 py-2 text-center text-sm font-semibold ${
                      current === t.slug
                        ? "bg-white text-gray-900 shadow-sm dark:bg-[#3a3a3c] dark:text-gray-50"
                        : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {t.accent} {t.name}
                  </Link>
                ))}
              </div>
            )}

            {shownTeams.map((team) => (
              <div key={team.slug} className="flex flex-col gap-6">
                {team.nothingYet && (
                  <p className={`${card} p-5 text-center text-sm text-gray-500 dark:text-gray-400`}>
                    No results yet this season — check back after the next game.
                  </p>
                )}

                {/* League record */}
                {team.record.played > 0 && (
                  <section>
                    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                      <h2 className="text-xl font-bold">League Record</h2>
                      <div className="flex items-center gap-1">
                        {team.form.map((f, i) => (
                          <span key={i} className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold text-white ${BADGE[f]}`}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={`${card} p-4`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-center text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 dark:text-gray-400">
                              {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                                <th key={h} className="px-1 py-1 font-semibold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="text-base font-extrabold tabular-nums text-gray-900 dark:text-gray-50">
                              <td className="px-1 py-1">{team.record.played}</td>
                              <td className="px-1 py-1 text-green-700 dark:text-green-400">{team.record.won}</td>
                              <td className="px-1 py-1">{team.record.drawn}</td>
                              <td className="px-1 py-1 text-red-600 dark:text-red-400">{team.record.lost}</td>
                              <td className="px-1 py-1">{team.record.scored}</td>
                              <td className="px-1 py-1">{team.record.conceded}</td>
                              <td className="px-1 py-1">
                                {team.record.difference > 0 ? "+" : ""}
                                {team.record.difference}
                              </td>
                              <td className="px-1 py-1 text-green-700 dark:text-green-400">{team.record.points}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {team.cleanSheets > 0 && (
                        <p className="mt-2 border-t border-gray-100 pt-2 text-center text-sm text-gray-600 dark:border-white/10 dark:text-gray-300">
                          🥅 <span className="font-semibold">{team.cleanSheets} clean sheet{team.cleanSheets === 1 ? "" : "s"}</span> this season
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Recent results: rows like Home's Last result */}
                {team.results.length > 0 && (
                  <section>
                    <h2 className="mb-2.5 px-1 text-xl font-bold">Recent Results</h2>
                    <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
                      {team.results.map((m) => {
                        const us = m.goals.length;
                        const them = m.opponentGoals;
                        const result = us > them ? "W" : us === them ? "D" : "L";
                        return (
                          <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                            <span className={`grid h-11 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-lg font-extrabold text-white ${BADGE[result]}`}>
                              {us}–{them}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold">
                                {m.home ? "vs" : "at"} {m.opponent}
                              </span>
                              <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(m.date)} · {m.home ? "Home" : "Away"}
                                {m.friendly ? (m.cup ? " · Cup" : " · Friendly") : ""}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Top scorers / assists / saves */}
                {[
                  { title: "⚽ Top Scorers", rows: team.scorers, field: "goals" as const },
                  { title: "🅰️ Most Assists", rows: team.assisters, field: "assists" as const },
                  { title: "🧤 Most Saves", rows: team.keepers, field: "saves" as const },
                ]
                  .filter((c) => c.rows.length > 0)
                  .map((list) => (
                    <section key={list.title}>
                      <h2 className="mb-2.5 px-1 text-xl font-bold">{list.title}</h2>
                      <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
                        {list.rows.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                            <span className="w-5 shrink-0 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold">{fullNames ? p.name : shortName(p.name)}</span>
                            <span className="shrink-0 text-lg font-extrabold tabular-nums text-green-700 dark:text-green-400">{p[list.field]}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>{CLUB.fullName}</p>
      </footer>
    </div>
  );
}
