// Public, read-only results for parents — no password.
//
// It reads storage directly rather than going through an API, so there is no
// public endpoint to widen by accident, and it only ever renders what is safe
// to show: scores, and players by shortened name (see `shortName`). Nothing
// from the kit or camera side appears here.
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listPlayers, type Player } from "@/lib/statsStorage";
import { listMatches, type Match } from "@/lib/matchStorage";
import { getCurrentSeason } from "@/lib/season";
import { TEAMS } from "@/lib/teams";
import { countsTowardsRecord, outcome, seasonRecord } from "@/lib/record";
import { cleanSheetCount } from "@/lib/cleanSheets";
import { CLUB } from "@/club.config";

// Always fresh — results change through the season.
export const dynamic = "force-dynamic";

export const metadata = {
  title: `Results – ${CLUB.name}`,
  description: `Results, tables and top scorers for ${CLUB.fullName}.`,
};

/**
 * "Alfie Essery" -> "Alfie E." — enough for parents to know who scored without
 * publishing children's full names on a page anyone can open.
 */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

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
  // switched off in club.config.ts while the teams play non-competitively
  if (!CLUB.publicResults) redirect("/");
  const { team: requested } = await searchParams;
  const selected = TEAMS.some((t) => t.slug === requested) ? requested : null;

  const [players, matches, season] = await Promise.all([
    listPlayers(),
    listMatches(),
    getCurrentSeason(),
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-gradient-to-br from-green-900 to-green-500 px-6 pb-8 pt-10 text-center text-white">
        <Image
          src={CLUB.crest.src}
          alt={CLUB.crest.alt}
          width={CLUB.crest.width}
          height={CLUB.crest.height}
          className="mx-auto mb-3 h-20 w-auto drop-shadow-lg"
          priority
        />
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Results</h1>
        <p className="mt-1 text-green-100">{season} season</p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        {teams.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="mb-3 text-4xl">⚽</p>
            <p>No results yet this season — check back after the next game.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {tabs.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/results?team=${t.slug}`}
                    className={`flex-1 rounded-xl border-2 px-3 py-2 text-center text-sm font-bold ${
                      current === t.slug
                        ? "border-green-600 bg-green-600 text-white shadow"
                        : "border-gray-200 bg-white text-gray-700 hover:border-green-400 hover:text-green-700"
                    }`}
                  >
                    {t.accent} {t.name}
                  </Link>
                ))}
              </div>
            )}

            {shownTeams.map((team) => (
              <section key={team.slug}>
                <h2 className="mb-3 text-lg font-extrabold text-gray-900">
                  {team.accent} {team.name}
                </h2>

                {team.nothingYet && (
                  <p className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-500 shadow-sm">
                    No results yet this season — check back after the next game.
                  </p>
                )}

                {/* League record */}
                {team.record.played > 0 && (
                  <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-600">League record</p>
                      <div className="flex items-center gap-1">
                        {team.form.map((f, i) => (
                          <span
                            key={i}
                            className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-white ${
                              f === "W"
                                ? "bg-green-600"
                                : f === "D"
                                  ? "bg-gray-400"
                                  : "bg-red-400"
                            }`}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-center text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                              <th key={h} className="px-1 py-1 font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="font-extrabold tabular-nums text-gray-900">
                            <td className="px-1 py-1">{team.record.played}</td>
                            <td className="px-1 py-1 text-green-700">{team.record.won}</td>
                            <td className="px-1 py-1">{team.record.drawn}</td>
                            <td className="px-1 py-1 text-red-500">{team.record.lost}</td>
                            <td className="px-1 py-1">{team.record.scored}</td>
                            <td className="px-1 py-1">{team.record.conceded}</td>
                            <td className="px-1 py-1">
                              {team.record.difference > 0 ? "+" : ""}
                              {team.record.difference}
                            </td>
                            <td className="px-1 py-1 text-green-700">
                              {team.record.points}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {team.cleanSheets > 0 && (
                      <p className="mt-2 text-xs text-gray-600">
                        🥅{" "}
                        <span className="font-semibold">
                          {team.cleanSheets} clean sheet
                          {team.cleanSheets === 1 ? "" : "s"}
                        </span>{" "}
                        this season
                      </p>
                    )}
                  </div>
                )}

                {/* Recent results */}
                {team.results.length > 0 && (
                  <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-sm font-semibold text-gray-600">
                      Recent results
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {team.results.map((m) => {
                        const us = m.goals.length;
                        const them = m.opponentGoals;
                        const result = us > them ? "W" : us === them ? "D" : "L";
                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
                          >
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] font-bold text-white ${
                                result === "W"
                                  ? "bg-green-600"
                                  : result === "D"
                                    ? "bg-gray-400"
                                    : "bg-red-400"
                              }`}
                            >
                              {result}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                              <span className="font-bold">
                                {us}–{them}
                              </span>{" "}
                              {m.home ? "v" : "away at"} {m.opponent}
                              {m.friendly && (
                                <span className="text-gray-400">
                                  {m.cup ? " · cup" : " · friendly"}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-gray-500">
                              {formatDate(m.date)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top scorers / assists */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { title: "⚽ Top Scorers", rows: team.scorers, field: "goals" as const },
                    { title: "🅰️ Most Assists", rows: team.assisters, field: "assists" as const },
                    { title: "🧤 Most Saves", rows: team.keepers, field: "saves" as const },
                  ]
                    .filter((c) => c.rows.length > 0)
                    .map((card) => (
                      <div
                        key={card.title}
                        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                      >
                        <p className="mb-2 text-sm font-semibold text-gray-600">
                          {card.title}
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {card.rows.map((p) => (
                            <div key={p.id} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                                {shortName(p.name)}
                              </span>
                              <span className="shrink-0 text-sm font-extrabold tabular-nums text-green-700">
                                {p[card.field]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-sm text-gray-500">
        <p>{CLUB.fullName}</p>
        <Link
          href="/"
          className="mt-1 inline-block font-semibold text-green-700 hover:underline"
        >
          ← Team Hub
        </Link>
      </footer>
    </div>
  );
}
