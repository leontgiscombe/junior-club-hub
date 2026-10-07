"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TEAMS, teamName } from "@/lib/teams";
import { positionIcon, statsForSquad } from "@/lib/positions";
import { cleanSheetCount } from "@/lib/cleanSheets";
import type { Position } from "@/lib/statsStorage";
import {
  countsTowardsRecord,
  outcome,
  seasonRecord,
  type SeasonRecord,
} from "@/lib/record";
import { useClub } from "./ClubProvider";

type StatField =
  | "appearances"
  | "goals"
  | "assists"
  | "saves"
  | "penaltiesSaved"
  | "potm"
  | "mostImproved"
  | "bestTrainer";

interface Player {
  id: string;
  team: string;
  name: string;
  position?: Position;
  appearances: number;
  goals: number;
  assists: number;
  saves: number;
  penaltiesSaved: number;
  potm: number;
  mostImproved: number;
  bestTrainer: number;
}

interface Match {
  team: string;
  goals: unknown[];
  opponentGoals: number;
  friendly: boolean;
  resultLogged: boolean;
}

const AWARDS: {
  field: StatField;
  label: string;
  icon: string;
  unit: [string, string];
}[] = [
  { field: "goals", label: "Top Scorer", icon: "🥇", unit: ["goal", "goals"] },
  { field: "assists", label: "Most Assists", icon: "🅰️", unit: ["assist", "assists"] },
  {
    field: "potm",
    label: "Player of the Match",
    icon: "🏆",
    unit: ["award", "awards"],
  },
  { field: "mostImproved", label: "Most Improved", icon: "📈", unit: ["award", "awards"] },
  { field: "bestTrainer", label: "Best Trainer", icon: "💪", unit: ["award", "awards"] },
  {
    field: "appearances",
    label: "Most Appearances",
    icon: "👟",
    unit: ["appearance", "appearances"],
  },
  { field: "saves", label: "Most Saves", icon: "🧤", unit: ["save", "saves"] },
  {
    field: "penaltiesSaved",
    label: "Penalty King",
    icon: "⛔",
    unit: ["penalty saved", "penalties saved"],
  },
];

// The squad table's columns, in order. Only the ones the squad actually has
// between them are shown, so a side without a keeper doesn't carry two empty
// columns across the slide (see lib/positions.ts).
const TABLE: { field: StatField; short: string }[] = [
  { field: "appearances", short: "Apps" },
  { field: "goals", short: "G" },
  { field: "assists", short: "A" },
  { field: "saves", short: "Sv" },
  { field: "penaltiesSaved", short: "PS" },
  { field: "potm", short: "POTM" },
  { field: "mostImproved", short: "MI" },
  { field: "bestTrainer", short: "BT" },
];

const TABLE_ORDER = TABLE.map((c) => c.field);

type Slide =
  | { kind: "title" }
  | { kind: "team"; team: string; count: number }
  | {
      kind: "award";
      team: string;
      label: string;
      icon: string;
      names: string[];
      value: number;
      unit: [string, string];
    }
  | {
      kind: "record";
      team: string;
      record: SeasonRecord;
      form: ("W" | "D" | "L")[];
      /** The team's clean sheets, across every game — cup games included. */
      cleanSheets: number;
    }
  | {
      kind: "leaderboard";
      team: string;
      players: Player[];
      columns: { field: StatField; short: string }[];
    }
  | { kind: "end" };

function teamAccent(slug: string) {
  return TEAMS.find((t) => t.slug === slug)?.accent ?? "⚽";
}

export default function StatsPresentation() {
  const CLUB = useClub();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [season, setSeason] = useState("");
  const [index, setIndex] = useState(0);
  // When opened from a team's stats page, present just that team.
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  const load = useCallback(async (adminKey: string, archiveId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = archiveId
        ? `/api/stats/season?key=${encodeURIComponent(adminKey)}&id=${encodeURIComponent(archiveId)}`
        : `/api/stats?key=${encodeURIComponent(adminKey)}`;
      const res = await fetch(url);
      if (res.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (archiveId) {
        setPlayers(data.archive?.players ?? []);
        setSeason(data.archive?.name ?? "");
        // Archives now keep the match log too, so a past season can show its
        // record (older archives hold players only and simply skip the slide).
        setMatches(data.archive?.matches ?? []);
      } else {
        setPlayers(data.players ?? []);
        setSeason(data.season ?? "");
      }
      if (!archiveId) {
        // The live season's record comes from the match log.
        const matchRes = await fetch(
          `/api/stats/matches?key=${encodeURIComponent(adminKey)}`
        );
        if (matchRes.ok) setMatches((await matchRes.json()).matches ?? []);
      }
      setAuthed(true);
    } catch {
      setError("Could not load the stats. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("key");
    const urlTeam = params.get("team");
    if (urlTeam && TEAMS.some((t) => t.slug === urlTeam)) {
      setTeamFilter(urlTeam);
    }
    if (urlKey) {
      setKey(urlKey);
      load(urlKey, params.get("archive"));
    }
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [{ kind: "title" }];
    // Just the team you came from, or the whole club when none was given.
    const teams = teamFilter ? TEAMS.filter((t) => t.slug === teamFilter) : TEAMS;
    for (const team of teams) {
      const squad = players.filter((p) => p.team === team.slug);
      if (squad.length === 0) continue;
      out.push({ kind: "team", team: team.slug, count: squad.length });

      const counted = matches.filter(
        (m) => m.team === team.slug && countsTowardsRecord(m)
      );
      if (counted.length > 0) {
        out.push({
          kind: "record",
          team: team.slug,
          record: seasonRecord(counted),
          form: counted.slice(-5).map(outcome),
          cleanSheets: cleanSheetCount(
            matches.filter((m) => m.team === team.slug)
          ),
        });
      }
      for (const award of AWARDS) {
        const max = squad.reduce((m, p) => Math.max(m, p[award.field] ?? 0), 0);
        if (max === 0) continue;
        out.push({
          kind: "award",
          team: team.slug,
          label: award.label,
          icon: award.icon,
          names: squad
            .filter((p) => (p[award.field] ?? 0) === max)
            .map((p) => p.name)
            .sort((a, b) => a.localeCompare(b)),
          value: max,
          unit: award.unit,
        });
      }
      const fields = new Set(statsForSquad(squad, TABLE_ORDER));
      out.push({
        kind: "leaderboard",
        team: team.slug,
        players: [...squad].sort(
          (a, b) => (b.goals ?? 0) - (a.goals ?? 0) || a.name.localeCompare(b.name)
        ),
        columns: TABLE.filter((c) => fields.has(c.field)),
      });
    }
    out.push({ kind: "end" });
    return out;
  }, [players, matches, teamFilter]);

  const total = slides.length;
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!authed) return;
    function onKey(e: KeyboardEvent) {
      if (["ArrowRight", " ", "PageDown", "Enter"].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authed, next, prev]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🎬</div>
            <h1 className="text-xl font-extrabold text-gray-900">Presentation Mode</h1>
            <p className="text-sm text-gray-500 mt-1">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key, null)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center">{error}</p>}
          <button
            onClick={() => load(key, null)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Loading…" : "Start Presentation"}
          </button>
          <Link
            href="/admin/stats"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700"
          >
            ← Back to Stats
          </Link>
        </div>
      </main>
    );
  }

  const slide = slides[Math.min(index, total - 1)];

  return (
    <main
      onClick={next}
      className="relative min-h-screen select-none overflow-y-auto bg-gradient-to-br from-green-950 via-green-800 to-green-600 text-white"
    >
      {/* Slide */}
      <div
        key={index}
        className="slide-in flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      >
        {slide.kind === "title" && (
          <>
            <Image
              src={CLUB.crest.src}
              unoptimized
              alt={CLUB.crest.alt}
              width={CLUB.crest.width}
              height={CLUB.crest.height}
              className="mb-8 h-[22vh] w-auto drop-shadow-2xl"
              priority
            />
            <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-extrabold leading-none tracking-tight drop-shadow">
              {CLUB.name}
            </h1>
            <p className="pop-in mt-6 text-[clamp(1.25rem,4vw,2.5rem)] font-bold text-green-200">
              {teamFilter ? `${teamName(teamFilter)} · ` : ""}
              {season} Season Awards
            </p>
          </>
        )}

        {slide.kind === "team" && (
          <>
            <div className="text-[clamp(4rem,16vw,11rem)] leading-none">
              {teamAccent(slide.team)}
            </div>
            <h2 className="pop-in mt-6 text-[clamp(2.5rem,10vw,7rem)] font-extrabold leading-none tracking-tight">
              {teamName(slide.team)}
            </h2>
            <p className="mt-6 text-[clamp(1rem,3vw,1.75rem)] font-semibold text-green-200">
              {slide.count} player{slide.count === 1 ? "" : "s"} · {season}
            </p>
          </>
        )}

        {slide.kind === "record" && (
          <>
            <p className="text-[clamp(0.9rem,2.5vw,1.5rem)] font-bold uppercase tracking-[0.2em] text-green-300">
              {teamAccent(slide.team)} {teamName(slide.team)}
            </p>
            <h2 className="mt-2 text-[clamp(1.5rem,5vw,3.25rem)] font-bold text-green-100">
              {season} League Record
            </h2>

            <div className="pop-in mt-8 grid w-full max-w-4xl grid-cols-4 gap-3">
              {[
                { label: "Played", value: slide.record.played },
                { label: "Won", value: slide.record.won },
                { label: "Drawn", value: slide.record.drawn },
                { label: "Lost", value: slide.record.lost },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-2xl bg-white/10 px-2 py-4 backdrop-blur"
                >
                  <p className="text-[clamp(1.75rem,7vw,4.5rem)] font-extrabold leading-none tabular-nums">
                    {cell.value}
                  </p>
                  <p className="mt-2 text-[clamp(0.7rem,1.8vw,1.1rem)] font-semibold uppercase tracking-wider text-green-200">
                    {cell.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[clamp(1rem,3vw,1.9rem)] font-semibold text-green-100">
              Scored {slide.record.scored} · Conceded {slide.record.conceded} · Goal
              difference {slide.record.difference > 0 ? "+" : ""}
              {slide.record.difference}
            </p>

            {slide.cleanSheets > 0 && (
              <p className="mt-3 text-[clamp(1rem,3vw,1.9rem)] font-semibold text-green-100">
                🥅 {slide.cleanSheets} clean sheet
                {slide.cleanSheets === 1 ? "" : "s"}
              </p>
            )}

            <p className="mt-6 rounded-full bg-white/15 px-8 py-3 text-[clamp(1.1rem,3.5vw,2rem)] font-bold backdrop-blur">
              {slide.record.points} point{slide.record.points === 1 ? "" : "s"}
            </p>

            {slide.form.length > 0 && (
              <div className="mt-6 flex items-center gap-2">
                {slide.form.map((f, i) => (
                  <span
                    key={i}
                    className={`grid h-[clamp(1.6rem,4vw,2.5rem)] w-[clamp(1.6rem,4vw,2.5rem)] place-items-center rounded-lg text-[clamp(0.8rem,2vw,1.25rem)] font-extrabold ${
                      f === "W"
                        ? "bg-green-500 text-white"
                        : f === "D"
                          ? "bg-white/30 text-white"
                          : "bg-red-500/80 text-white"
                    }`}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {slide.kind === "award" && (
          <>
            <p className="text-[clamp(0.9rem,2.5vw,1.5rem)] font-bold uppercase tracking-[0.2em] text-green-300">
              {teamAccent(slide.team)} {teamName(slide.team)}
            </p>
            <div className="mt-4 text-[clamp(3.5rem,13vw,9rem)] leading-none">
              {slide.icon}
            </div>
            <h2 className="mt-2 text-[clamp(1.5rem,5vw,3.25rem)] font-bold text-green-100">
              {slide.label}
            </h2>
            <p className="pop-in mt-6 text-[clamp(2.25rem,9vw,6.5rem)] font-extrabold leading-[1.05] tracking-tight drop-shadow">
              {slide.names.join(" & ")}
            </p>
            <p className="mt-6 rounded-full bg-white/15 px-8 py-3 text-[clamp(1.1rem,3.5vw,2rem)] font-bold text-white backdrop-blur">
              {slide.value} {slide.value === 1 ? slide.unit[0] : slide.unit[1]}
            </p>
          </>
        )}

        {slide.kind === "leaderboard" && (
          <div className="w-full max-w-5xl">
            <h2 className="text-[clamp(1.5rem,5vw,3rem)] font-extrabold tracking-tight">
              {teamAccent(slide.team)} {teamName(slide.team)}
            </h2>
            <p className="mt-1 text-[clamp(0.8rem,2vw,1.15rem)] font-semibold text-green-300">
              {season} squad stats
            </p>
            {/* Big squads scroll inside the card rather than running off-slide */}
            <div className="mt-6 max-h-[68vh] overflow-auto rounded-2xl bg-white/10 p-2 backdrop-blur">
              {/* table-fixed keeps every column on screen on a phone — the name
                  column truncates instead of pushing MI off the edge */}
              <table
                className={`w-full table-fixed ${
                  slide.columns.length > 6
                    ? "text-[clamp(0.56rem,1.7vw,1.2rem)]"
                    : "text-[clamp(0.66rem,1.9vw,1.25rem)]"
                }`}
              >
                <thead>
                  <tr className="text-green-200">
                    {/* Sticky so the columns stay readable while a big squad
                        scrolls. A squad with a keeper in it has two more stat
                        columns, so the name column gives up some width rather
                        than letting the headings clip on a phone. */}
                    <th
                      className={`sticky top-0 bg-green-900/90 px-1 py-2 text-left font-bold backdrop-blur sm:px-2 ${
                        slide.columns.length > 6 ? "w-[26%]" : "w-[34%]"
                      }`}
                    >
                      Player
                    </th>
                    {slide.columns.map((c) => (
                      <th
                        key={c.field}
                        className="sticky top-0 bg-green-900/90 px-1 py-2 text-center font-bold backdrop-blur sm:px-2"
                      >
                        {c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slide.players.map((p, i) => (
                    <tr
                      key={p.id}
                      className={i % 2 ? "bg-white/5" : undefined}
                    >
                      <td className="truncate px-1 py-2 text-left font-bold sm:px-2">
                        {p.position === "goalkeeper" && (
                          <span className="mr-1" title="Goalkeeper">
                            {positionIcon(p.position)}
                          </span>
                        )}
                        {p.name}
                      </td>
                      {slide.columns.map((c) => (
                        <td
                          key={c.field}
                          className="px-1 py-2 text-center font-semibold tabular-nums sm:px-2"
                        >
                          {p[c.field] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {slide.kind === "end" && (
          <>
            <div className="text-[clamp(4rem,15vw,10rem)] leading-none">👏</div>
            <h2 className="pop-in mt-6 text-[clamp(2rem,8vw,5.5rem)] font-extrabold leading-none tracking-tight">
              Well done everyone!
            </h2>
            <p className="mt-6 text-[clamp(1rem,3vw,1.75rem)] font-semibold text-green-200">
              {CLUB.fullName} · {season}
            </p>
          </>
        )}
      </div>

      {/* Controls */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={`/admin/stats?key=${encodeURIComponent(key)}`}
          className="pointer-events-auto rounded-full bg-black/25 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur hover:bg-black/40 hover:text-white"
        >
          ← Exit
        </Link>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={prev}
            disabled={index === 0}
            className="rounded-full bg-black/25 px-4 py-2 text-lg font-bold text-white/80 backdrop-blur hover:bg-black/40 hover:text-white disabled:opacity-30 cursor-pointer"
            aria-label="Previous slide"
          >
            ‹
          </button>
          <span className="rounded-full bg-black/25 px-4 py-2 text-xs font-semibold tabular-nums text-white/80 backdrop-blur">
            {index + 1} / {total}
          </span>
          <button
            onClick={next}
            disabled={index === total - 1}
            className="rounded-full bg-black/25 px-4 py-2 text-lg font-bold text-white/80 backdrop-blur hover:bg-black/40 hover:text-white disabled:opacity-30 cursor-pointer"
            aria-label="Next slide"
          >
            ›
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-full bg-black/25 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur hover:bg-black/40 hover:text-white cursor-pointer"
            title="Fullscreen (F)"
          >
            ⛶
          </button>
        </div>
      </div>

      {players.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-green-200">
          No stats yet — add players on the stats page first.
        </p>
      )}
    </main>
  );
}
