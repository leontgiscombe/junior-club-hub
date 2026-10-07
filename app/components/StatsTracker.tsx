"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useClub, useTeams } from "./ClubProvider";
import { nameOf, type Team } from "@/lib/teams";
import { useMyTeam } from "@/lib/myTeam";
import { approachingMilestones, reachedMilestones } from "@/lib/milestones";
import {
  isKeeperStat,
  positionIcon,
  positionLabel,
  statsForPlayer,
  statsForSquad,
} from "@/lib/positions";
import { cleanSheetCount, playedCount } from "@/lib/cleanSheets";
import { countsTowardsRecord, outcome, seasonRecord } from "@/lib/record";
import type { Position } from "@/lib/statsStorage";
import { accountKey, keyQuery } from "./coachKey";

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
  position: Position;
  appearances: number;
  goals: number;
  assists: number;
  saves: number;
  penaltiesSaved: number;
  potm: number;
  mostImproved: number;
  bestTrainer: number;
  createdAt: string;
}

// Just enough of a game to say what the match log is holding for a team.
interface Match {
  id: string;
  team: string;
  opponent: string;
  date: string;
  home: boolean;
  goals: unknown[];
  opponentGoals: number;
  appearanceIds: string[];
  friendly: boolean;
  resultLogged: boolean;
}

interface SeasonSummary {
  id: string;
  name: string;
  archivedAt: string;
  playerCount: number;
  matchCount: number;
}

// Every stat, in the order they appear on a card, in the totals and in the CSV.
// Which of them a given player shows depends on their position — see
// lib/positions.ts.
const STATS: { field: StatField; label: string; short: string; icon: string }[] = [
  { field: "appearances", label: "Appearances", short: "Apps", icon: "👟" },
  { field: "goals", label: "Goals", short: "Goals", icon: "⚽" },
  { field: "assists", label: "Assists", short: "Assists", icon: "🅰️" },
  { field: "saves", label: "Saves", short: "Saves", icon: "🧤" },
  { field: "penaltiesSaved", label: "Penalties Saved", short: "Pens Saved", icon: "⛔" },
  { field: "potm", label: "Player of the Match", short: "POTM", icon: "🏆" },
  { field: "mostImproved", label: "Most Improved", short: "Most Improved", icon: "📈" },
  { field: "bestTrainer", label: "Best Trainer", short: "Best Trainer", icon: "💪" },
];

const STAT_ORDER = STATS.map((s) => s.field);

const AWARDS: { field: StatField; label: string; icon: string }[] = [
  { field: "goals", label: "Top Scorer", icon: "🥇" },
  { field: "assists", label: "Most Assists", icon: "🅰️" },
  { field: "appearances", label: "Most Appearances", icon: "👟" },
  { field: "saves", label: "Most Saves", icon: "🧤" },
  { field: "penaltiesSaved", label: "Most Penalties Saved", icon: "⛔" },
  { field: "potm", label: "Most Player of the Match", icon: "🏆" },
  { field: "mostImproved", label: "Most Improved", icon: "📈" },
  { field: "bestTrainer", label: "Best Trainer", icon: "💪" },
];

const ZERO: Record<StatField, number> = {
  appearances: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  penaltiesSaved: 0,
  potm: 0,
  mostImproved: 0,
  bestTrainer: 0,
};


// "2026/27" for a date in the 2026-27 season (August–May, July onwards counts
// as the new one) — mirrors defaultSeasonName in lib/statsStorage.ts.
function seasonFromDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const start = now.getMonth() >= 6 ? year : year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function nextSeasonName(current: string): string {
  const match = /^(\d{4})\/\d{2}$/.exec(current.trim());
  const base = match ? Number(match[1]) : Number(seasonFromDate().slice(0, 4));
  const start = base + 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function saveCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// One file per team — the team is in the filename, so no Team column needed.
// Every stat is a column whatever the position, so a spreadsheet stays square.
function downloadTeamCSV(players: Player[], team: string) {
  const header = ["Player", "Position", ...STATS.map((s) => s.label)].join(",");
  const lines = players.map((p) =>
    [
      csvCell(p.name),
      csvCell(positionLabel(p.position)),
      ...STATS.map((s) => p[s.field] ?? 0),
    ].join(",")
  );
  saveCSV([header, ...lines].join("\n"), `stats-${team}.csv`);
}

// An archived season spans every team, so that export keeps a Team column.
function downloadSeasonCSV(players: Player[], seasonLabel: string, teams: readonly Team[]) {
  const header = ["Team", "Player", "Position", ...STATS.map((s) => s.label)].join(",");
  const lines = [...players]
    .sort(
      (a, b) =>
        teams.findIndex((t) => t.slug === a.team) -
          teams.findIndex((t) => t.slug === b.team) || a.name.localeCompare(b.name)
    )
    .map((p) =>
      [
        csvCell(nameOf(teams, p.team)),
        csvCell(p.name),
        csvCell(positionLabel(p.position)),
        ...STATS.map((s) => p[s.field] ?? 0),
      ].join(",")
    );
  const slug = seasonLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  saveCSV([header, ...lines].join("\n"), `stats-${slug || "season"}.csv`);
}

// Today as YYYY-MM-DD, so fixture dates can be compared as plain strings.
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

// "Sat 4 Oct" for a fixture's YYYY-MM-DD date.
function formatFixture(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// The stat cards on one player's card: the ones their position is judged on,
// plus any other they have actually recorded (a keeper's goal, say).
function statsFor(player: Player) {
  const fields = new Set(statsForPlayer(player, STAT_ORDER));
  return STATS.filter((s) => fields.has(s.field));
}

// The tappable title row of a Player stats card that folds up.
function FoldHeader({
  title,
  summary,
  open,
  onToggle,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 text-left cursor-pointer"
    >
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-600">
        {title}
      </span>
      {summary && !open && (
        <span className="shrink-0 text-xs text-gray-400">{summary}</span>
      )}
      <span className="shrink-0 text-xs text-gray-400">{open ? "▲" : "▼"}</span>
    </button>
  );
}

// The player(s) with the highest tally for a stat — null when nobody has any.
function winners(list: Player[], field: StatField) {
  const max = list.reduce((m, p) => Math.max(m, p[field]), 0);
  if (max === 0) return null;
  return {
    max,
    names: list
      .filter((p) => p[field] === max)
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b)),
  };
}

export default function StatsTracker() {
  const { TEAMS, teamName, teamAccent } = useTeams();
  const { features } = useClub();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  // The match log's games, so this page can say what is already in there and
  // what still needs a score.
  const [matches, setMatches] = useState<Match[]>([]);
  const [season, setSeason] = useState("");
  const [archives, setArchives] = useState<SeasonSummary[]>([]);
  // opens on the team last picked on this device (see lib/myTeam.ts)
  const [team, setTeam] = useMyTeam();
  const [sortBy, setSortBy] = useState<"name" | StatField>("name");
  // The tallies are read-only until Edit is pressed, so a stray tap while
  // scrolling can't quietly change someone's season totals.
  const [editing, setEditing] = useState(false);
  // What's unfolded under Player stats. Squad totals and awards start open,
  // milestones folded; each player folds to one row so the squad scrolls
  // easily (Edit opens them all, as the tallies need the full card).
  const [cardOpen, setCardOpen] = useState<Record<string, boolean>>({});
  const [playerOpen, setPlayerOpen] = useState<Record<string, boolean>>({});
  const cardIsOpen = (id: string) => cardOpen[id] ?? id !== "milestones";
  const toggleCard = (id: string) =>
    setCardOpen((o) => ({ ...o, [id]: !cardIsOpen(id) }));

  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  // paste a whole squad at once, one name per line
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [showSeason, setShowSeason] = useState(false);
  const [newSeason, setNewSeason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(adminKey)}`);
      if (res.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPlayers(data.players);
      setSeason(data.season ?? "");
      setArchives(data.archives ?? []);
      setAuthed(true);
      // Best effort — the page is still useful if the match log won't load.
      const matchRes = await fetch(
        `/api/stats/matches?key=${encodeURIComponent(adminKey)}`
      );
      if (matchRes.ok) setMatches((await matchRes.json()).matches ?? []);
    } catch {
      setError("Could not load the stats. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      setKey(urlKey);
      load(urlKey);
    } else {
      // signed in with an account: no password needed
      accountKey().then((k) => {
        if (k) {
          setKey(k);
          load(k);
        }
      });
    }
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add player");
      setPlayers((prev) => [...prev, data.player]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add player");
    } finally {
      setAdding(false);
    }
  }

  // Add a whole squad from pasted text — one name per line (or comma separated).
  // Repeats within the paste, and anyone already in this team, are skipped so a
  // list can safely be pasted twice.
  async function addMany(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setError(null);
    setBulkResult(null);

    const seen = new Set(
      players.filter((p) => p.team === team).map((p) => p.name.toLowerCase())
    );
    const queue: string[] = [];
    let skipped = 0;
    for (const raw of bulkText.split(/[\n,]/)) {
      const candidate = raw.trim();
      if (!candidate) continue;
      if (seen.has(candidate.toLowerCase())) {
        skipped++;
        continue;
      }
      seen.add(candidate.toLowerCase());
      queue.push(candidate);
    }

    if (queue.length === 0) {
      setBulkResult(
        skipped > 0
          ? `Nothing added — those ${skipped} name${skipped === 1 ? " is" : "s are"} already in ${teamName(team)}.`
          : "Paste at least one name."
      );
      return;
    }

    setAdding(true);
    const added: Player[] = [];
    try {
      for (const playerName of queue) {
        const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team, name: playerName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Could not add ${playerName}`);
        added.push(data.player);
      }
      setBulkText("");
      setBulkResult(
        `Added ${added.length} player${added.length === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · skipped ${skipped} already in the squad` : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add those players");
    } finally {
      // Keep whatever did save, even if one failed part-way through.
      if (added.length > 0) setPlayers((prev) => [...prev, ...added]);
      setAdding(false);
    }
  }

  async function bump(p: Player, field: StatField, delta: number) {
    const next = Math.max(0, p[field] + delta);
    if (next === p[field]) return;
    setPlayers((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, [field]: next } : x))
    );
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, [field]: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, [field]: p[field] } : x))
      );
    }
  }

  // Switch a player between outfield and goalkeeper. Nothing is lost either
  // way: the tallies all stay on the record, the card just shows the ones that
  // matter for the position (plus anything they have already recorded).
  async function togglePosition(p: Player) {
    const next: Position = p.position === "goalkeeper" ? "outfield" : "goalkeeper";
    setPlayers((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, position: next } : x))
    );
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, position: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, position: p.position } : x))
      );
    }
  }

  async function saveName(p: Player) {
    const trimmed = editingName.trim();
    setEditingId(null);
    if (!trimmed || trimmed === p.name) return;
    setPlayers((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, name: trimmed } : x))
    );
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, name: trimmed }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, name: p.name } : x))
      );
    }
  }

  async function removePlayer(p: Player) {
    if (!confirm(`Remove ${p.name} and their stats?`)) return;
    setBusyId(p.id);
    try {
      await fetch(`/api/stats?key=${encodeURIComponent(key)}&id=${p.id}`, {
        method: "DELETE",
      });
      setPlayers((prev) => prev.filter((x) => x.id !== p.id));
    } finally {
      setBusyId(null);
    }
  }

  async function endSeason(e: React.FormEvent) {
    e.preventDefault();
    const target = newSeason.trim();
    if (!target || archiving) return;
    if (
      !confirm(
        `Archive ${season} and start ${target}?\n\n` +
          `Every player's tallies go back to zero and the match log is emptied, ` +
          `ready for the new season. The squads are kept, and all of ${season} — ` +
          `tallies and games — is saved to Past seasons below. If you do this by ` +
          `mistake you can put it back with Restore.`
      )
    ) {
      return;
    }
    setArchiving(true);
    setSeasonError(null);
    try {
      const res = await fetch(`/api/stats/season?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSeason: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not archive the season");
      setSeason(data.season);
      setArchives(data.archives ?? []);
      setPlayers((prev) => prev.map((p) => ({ ...p, ...ZERO })));
      setShowSeason(false);
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : "Could not archive the season");
    } finally {
      setArchiving(false);
    }
  }

  // Undo for an accidental "archive & reset": puts a past season back as live.
  async function restoreArchive(archive: SeasonSummary) {
    const liveTallies = players.some((p) => STATS.some((s) => p[s.field] > 0));
    if (
      !confirm(
        `Restore ${archive.name}?\n\n` +
          `Every player's tallies go back to how they finished ${archive.name}, ` +
          `and the season label returns to ${archive.name}.` +
          (liveTallies
            ? `\n\nThe tallies recorded for ${season} will be saved to Past seasons first, so nothing is lost.`
            : "")
      )
    ) {
      return;
    }
    setBusyId(archive.id);
    setSeasonError(null);
    try {
      const res = await fetch(`/api/stats/season?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: archive.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not restore that season");
      setPlayers(data.players ?? []);
      setSeason(data.season);
      setArchives(data.archives ?? []);
    } catch (err) {
      setSeasonError(
        err instanceof Error ? err.message : "Could not restore that season"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function exportArchive(archive: SeasonSummary) {
    setBusyId(archive.id);
    setSeasonError(null);
    try {
      const res = await fetch(
        `/api/stats/season?key=${encodeURIComponent(key)}&id=${archive.id}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load that season");
      downloadSeasonCSV(data.archive.players ?? [], archive.name, TEAMS);
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : "Could not load that season");
    } finally {
      setBusyId(null);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">📊</div>
            <h1 className="text-xl font-extrabold text-gray-900">Stats Tracker</h1>
            <p className="text-sm text-gray-500 mt-1">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Loading…" : "Open stats"}
          </button>
          <Link
            href="/"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700"
          >
            ← Back to Team Hub
          </Link>
        </div>
      </main>
    );
  }

  const shown = players
    .filter((p) => p.team === team)
    .sort((a, b) =>
      sortBy === "name"
        ? a.name.localeCompare(b.name)
        : b[sortBy] - a[sortBy] || a.name.localeCompare(b.name)
    );

  // What the match log already holds for this team, so the card below says
  // something true about this season rather than only pointing at another page.
  const todayStr = today();
  const teamGames = matches.filter((m) => m.team === team);
  const nextGame = teamGames
    .filter((m) => m.goals.length === 0 && m.opponentGoals === 0 && m.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const loggedGames = teamGames.filter((m) => m.resultLogged).length;
  const needScore = teamGames.filter((m) => !m.resultLogged && m.date < todayStr).length;
  // A clean sheet belongs to the team, not to each player, so it is counted
  // in games here rather than on anybody's card.
  const teamCleanSheets = cleanSheetCount(teamGames);
  const gamesPlayed = playedCount(teamGames);
  // The team's own record, worked out the same way as the match log's table so
  // the two pages can never disagree: league games whose score is logged.
  const leagueGames = teamGames.filter(countsTowardsRecord);
  const record = seasonRecord(leagueGames);
  // Most recent five, oldest first, so the form reads left to right.
  const form = [...leagueGames]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .reverse()
    .map(outcome);

  // A squad with no keeper in it gets no Saves column to stare at.
  const squadFields = new Set(statsForSquad(shown, STAT_ORDER));
  // Squad totals are the stats every player can accrue. A keeper's saves stay
  // on their own card, where they mean something.
  const totals = STATS.filter(
    (s) => squadFields.has(s.field) && !isKeeperStat(s.field)
  ).map((s) => ({
    ...s,
    total: shown.reduce((sum, p) => sum + (p[s.field] ?? 0), 0),
  }));
  const awards = AWARDS.map((a) => ({ ...a, result: winners(shown, a.field) }));
  const hasAwards = awards.some((a) => a.result);
  const reached = reachedMilestones(shown);
  const approaching = approachingMilestones(shown);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-700 px-4 py-6 text-white">
        <Link
          href={`/admin${keyQuery(key)}`}
          className="text-sm font-medium text-green-200 hover:text-white"
        >
          ← Coach Admin
        </Link>
        <h1 className="text-xl font-extrabold mt-2">📊 Stats Tracker</h1>
        <p className="text-green-200 text-sm mt-0.5">
          {`${season ? `${season} season` : "Season"} · team record & clean sheets, ` +
            `then every player's own tallies`}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Team tabs */}
        <div className="flex gap-2 mb-5">
          {TEAMS.map((t) => (
            <button
              key={t.slug}
              onClick={() => setTeam(t.slug)}
              className={`flex-1 py-2 px-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                team === t.slug
                  ? "bg-green-600 border-green-600 text-white shadow"
                  : "bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-700"
              }`}
            >
              {t.accent} {t.name}
            </button>
          ))}
        </div>

        {/* Where the season's work actually goes in. Every total on this page
            is added up from the match log, and a coach landing here needs to
            know that before they start tapping steppers. */}
        <div className="mb-4 rounded-2xl border-2 border-green-600 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green-50 text-2xl">
              ⚽
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-gray-900">
                Fixtures and stats go in the Match Log
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                Log each game there — every goal with who assisted, player of the
                match, most improved and who played — and best trainer each Monday
                in the Training Log. The totals on this page fill in by themselves. Only change a number here to fix a mistake.
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            {teamGames.length === 0 ? (
              <>
                No games in the Match Log for {teamName(team)}{" "}
                yet — add this season&apos;s fixtures there and they&apos;re ready
                to fill in.
              </>
            ) : (
              <>
                {loggedGames} game{loggedGames === 1 ? "" : "s"} logged for{" "}
                {teamName(team)}
                {nextGame && (
                  <>
                    {" · next: "}
                    <span className="font-semibold text-gray-700">
                      {formatFixture(nextGame.date)} {nextGame.home ? "v" : "away at"}{" "}
                      {nextGame.opponent}
                    </span>
                  </>
                )}
              </>
            )}
          </p>

          {needScore > 0 && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {needScore} game{needScore === 1 ? " has" : "s have"} been played
              without a score — the totals here stay short until{" "}
              {needScore === 1 ? "it is" : "they are"} logged.
            </p>
          )}

          <Link
            href={`/admin/stats/matches${keyQuery(key)}`}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-green-700"
          >
            Open the Match Log →
          </Link>
          <Link
            href={`/admin/stats/training${keyQuery(key)}`}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-green-600 bg-white px-5 py-2 font-bold text-green-700 hover:bg-green-50"
          >
            🏃 Open the Training Log →
          </Link>
        </div>

        {/* Add player — only while editing */}
        {editing && (
        <form
          onSubmit={bulk ? addMany : addPlayer}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-600">
              ➕ Add {bulk ? "players" : "a player"} to {teamAccent(team)}{" "}
              {teamName(team)}
            </p>
            <button
              type="button"
              onClick={() => {
                setBulk((v) => !v);
                setBulkResult(null);
                setError(null);
              }}
              className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer whitespace-nowrap"
            >
              {bulk ? "Add One" : "Paste a Squad"}
            </button>
          </div>

          {bulk ? (
            <>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                placeholder={"Paste one name per line, e.g.\nBen Ferguson\nEmsley Whitaker\nHenry Mort"}
                aria-label="Squad list"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                type="submit"
                disabled={!bulkText.trim() || adding}
                className="mt-3 w-full rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                {adding ? "Adding…" : "Add all"}
              </button>
              <p className="mt-2 text-xs text-gray-400">
                Names already in {teamName(team)} are skipped, so it&apos;s safe to
                paste the same list twice.
              </p>
            </>
          ) : (
            <div className="flex gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Player name"
                className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                type="submit"
                disabled={!name.trim() || adding}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          )}

          {bulkResult && (
            <p className="mt-3 text-sm font-medium text-green-700">{bulkResult}</p>
          )}
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </form>
        )}

        {/* ── Team stats ──────────────────────────────────────────────────
            How the team has done: its record and its clean sheets, counted in
            games off the match log. Nothing here belongs to a player, and
            nothing below it belongs to the team. */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          🏆 Team stats — {teamName(team)}
        </p>
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {gamesPlayed === 0 ? (
            <p className="text-sm text-gray-400">
              No games logged yet — add them in the match log and the record fills
              in.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-600">League record</p>
                {form.length > 0 && (
                  <div className="flex items-center gap-1">
                    {form.map((f, i) => (
                      <span
                        key={i}
                        className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-white ${
                          f === "W" ? "bg-green-600" : f === "D" ? "bg-gray-400" : "bg-red-400"
                        }`}
                        title={f === "W" ? "Won" : f === "D" ? "Drawn" : "Lost"}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
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
                      <td className="px-1 py-1">{record.played}</td>
                      <td className="px-1 py-1 text-green-700">{record.won}</td>
                      <td className="px-1 py-1">{record.drawn}</td>
                      <td className="px-1 py-1 text-red-500">{record.lost}</td>
                      <td className="px-1 py-1">{record.scored}</td>
                      <td className="px-1 py-1">{record.conceded}</td>
                      <td className="px-1 py-1">
                        {record.difference > 0 ? "+" : ""}
                        {record.difference}
                      </td>
                      <td className="px-1 py-1 text-green-700">{record.points}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Clean sheets are counted across every game, cup and friendly
                  included, while the table above is league games only. */}
              {/* Worded exactly as the match log words it, so the same number
                  reads the same way in both places. */}
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-sm text-gray-600">
                  🥅{" "}
                  <span className="font-extrabold tabular-nums text-gray-900">
                    {teamCleanSheets} clean sheet{teamCleanSheets === 1 ? "" : "s"}
                  </span>{" "}
                  in {gamesPlayed} game{gamesPlayed === 1 ? "" : "s"} played
                </p>
                {leagueGames.length !== gamesPlayed && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    The table counts league games only; clean sheets count cup and
                    friendly games too.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Player stats ────────────────────────────────────────────────
            Everything from here down belongs to individual players. */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          🧑‍🤝‍🧑 Player stats — {teamName(team)}
        </p>

        {shown.length > 0 && (
          <>
            {/* Squad totals — the sum of the players' own tallies */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <FoldHeader
                title="Σ Squad Totals"
                open={cardIsOpen("totals")}
                onToggle={() => toggleCard("totals")}
              />
              {cardIsOpen("totals") && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {totals.map((t) => (
                    <div key={t.field} className="rounded-xl bg-gray-50 px-2 py-2 text-center">
                      <p className="text-lg font-extrabold text-gray-900 tabular-nums">
                        {t.total}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {t.icon} {t.short}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Milestones */}
            {(reached.length > 0 || approaching.length > 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                <FoldHeader
                  title={`🎯 Milestones — ${teamName(team)}`}
                  summary={[
                    reached.length > 0 && `${reached.length} reached`,
                    approaching.length > 0 && `${approaching.length} close`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  open={cardIsOpen("milestones")}
                  onToggle={() => toggleCard("milestones")}
                />
                {cardIsOpen("milestones") && reached.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {reached.map((m) => (
                      <span
                        key={`${m.playerId}-${m.label}`}
                        className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800"
                      >
                        {m.icon} {m.playerName} · {m.label}
                      </span>
                    ))}
                  </div>
                )}
                {cardIsOpen("milestones") && approaching.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-gray-400">Closing in</p>
                    <div className="flex flex-wrap gap-1.5">
                      {approaching.map((m) => (
                        <span
                          key={`${m.playerId}-${m.label}`}
                          className="rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-600"
                        >
                          {m.icon} {m.playerName} · {m.away} from {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Season awards */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <FoldHeader
                title={`🏅 ${season} Awards — ${teamName(team)}`}
                open={cardIsOpen("awards")}
                onToggle={() => toggleCard("awards")}
              />
              {!cardIsOpen("awards") ? null : hasAwards ? (
                <div className="mt-3 flex flex-col gap-2">
                  {awards.map((a) =>
                    a.result ? (
                      <div
                        key={a.field}
                        className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
                      >
                        <span className="text-base shrink-0">{a.icon}</span>
                        <span className="text-xs text-gray-500 shrink-0">{a.label}</span>
                        <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-900 text-right">
                          {a.result.names.join(", ")}
                        </span>
                        <span className="text-sm font-extrabold text-green-700 tabular-nums shrink-0">
                          {a.result.max}
                        </span>
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">
                  No awards yet — they appear once players have some stats.
                </p>
              )}
            </div>
          </>
        )}

        {/* Sort + count + export */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              {shown.length} player{shown.length === 1 ? "" : "s"} in {teamName(team)}
            </p>
            {!editing && shown.length > 0 && (
              <button
                onClick={() => {
                  const open = !shown.every((p) => playerOpen[p.id]);
                  setPlayerOpen(Object.fromEntries(shown.map((p) => [p.id, open])));
                }}
                className="text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer whitespace-nowrap"
              >
                {shown.every((p) => playerOpen[p.id]) ? "Close All ▲" : "Open All ▼"}
              </button>
            )}
            <button
              onClick={() => {
                setEditing((v) => !v);
                setEditingId(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap cursor-pointer ${
                editing
                  ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                  : "border-gray-300 bg-white text-gray-600 hover:border-green-400 hover:text-green-700"
              }`}
              title={
                editing
                  ? "Finish editing and lock the tallies"
                  : "Unlock the tallies to change them"
              }
            >
              {editing ? "✓ Done" : "✏️ Edit"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="text-xs text-gray-500">
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | StatField)}
                className="ml-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="name">Name (A–Z)</option>
                {STATS.filter((s) => squadFields.has(s.field)).map((s) => (
                  <option key={s.field} value={s.field}>
                    {s.short} (high–low)
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => downloadTeamCSV(shown, team)}
              disabled={shown.length === 0}
              className="text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              title={`Download ${teamName(team)} stats as a CSV`}
            >
              ⬇ Export <span className="hidden sm:inline">{teamName(team)} </span>CSV
            </button>
            <Link
              href={`/admin/stats/matches${keyQuery(key)}`}
              className="text-xs font-semibold text-green-700 hover:text-green-800 whitespace-nowrap"
              title="Log each game's goals and who assisted"
            >
              ⚽ Match Log
            </Link>
            <Link
              href={`/admin/stats/training${keyQuery(key)}`}
              className="text-xs font-semibold text-green-700 hover:text-green-800 whitespace-nowrap"
              title="Pick each Monday's best trainer"
            >
              🏃 Training Log
            </Link>
            {features.playerOfMonth && (
              <Link
                href={`/admin/stats/player-of-the-month${keyQuery(key)}`}
                className="text-xs font-semibold text-green-700 hover:text-green-800 whitespace-nowrap"
                title="This month's winner from the awards, with a poster"
              >
                🌟 Player of the Month
              </Link>
            )}
            <Link
              href={`/admin/stats/presentation${keyQuery(key, `team=${team}`)}`}
              className="text-xs font-semibold text-green-700 hover:text-green-800 whitespace-nowrap"
              title="Full-screen awards slideshow for presentation evening"
            >
              🎬 Presentation
            </Link>
          </div>
        </div>

        {editing && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Tallies unlocked. Goals and assists also come from the match log, so
            only change them here to fix a mistake — press{" "}
            <span className="font-semibold">Done</span> when you&apos;ve finished.
            Tap the <span className="font-semibold">👕 Outfield</span> /{" "}
            <span className="font-semibold">🧤 Goalkeeper</span> badge by a name to
            switch what that player is tracked on.
          </p>
        )}

        {shown.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🧑‍🤝‍🧑</p>
            <p>
              {editing
                ? "No players yet. Add one above."
                : "No players yet — press Edit to add one."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((p) => {
              const isOpen = editing || !!playerOpen[p.id];
              const toggle = () =>
                setPlayerOpen((o) => ({ ...o, [p.id]: !o[p.id] }));
              return (
                <div
                  key={p.id}
                  className="rounded-2xl shadow-sm border border-gray-100 bg-white p-4"
                >
                  <div
                    className={`flex items-center gap-2 ${isOpen ? "mb-3" : ""} ${
                      editing ? "" : "cursor-pointer"
                    }`}
                    {...(editing
                      ? {}
                      : {
                          role: "button",
                          tabIndex: 0,
                          "aria-expanded": isOpen,
                          onClick: toggle,
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle();
                            }
                          },
                        })}
                  >
                    {editingId === p.id ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveName(p);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => saveName(p)}
                          aria-label={`Rename ${p.name}`}
                          className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => saveName(p)}
                          className="text-xs font-bold text-green-700 hover:text-green-800 cursor-pointer shrink-0"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="flex-1 min-w-0 font-bold text-gray-900 truncate">
                          {p.name}
                        </p>
                        {editing ? (
                          <button
                            onClick={() => togglePosition(p)}
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                              p.position === "goalkeeper"
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-500"
                                : "border-gray-200 bg-white text-gray-500 hover:border-green-400 hover:text-green-700"
                            }`}
                            title={`${p.name} is ${
                              p.position === "goalkeeper" ? "a goalkeeper" : "outfield"
                            } — tap to switch`}
                          >
                            {positionIcon(p.position)} {positionLabel(p.position)}
                          </button>
                        ) : (
                          p.position === "goalkeeper" && (
                            <span
                              className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800"
                              title="Goalkeeper"
                            >
                              🧤 GK
                            </span>
                          )
                        )}
                        {!editing && (
                          <span className="shrink-0 text-xs text-gray-400">
                            {isOpen ? "▲" : "▼"}
                          </span>
                        )}
                        {editing && (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(p.id);
                                setEditingName(p.name);
                              }}
                              className="text-gray-300 hover:text-green-600 text-sm leading-none cursor-pointer shrink-0"
                              title={`Rename ${p.name}`}
                              aria-label={`Rename ${p.name}`}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => removePlayer(p)}
                              disabled={busyId === p.id}
                              className="text-gray-300 hover:text-red-400 text-lg leading-none cursor-pointer shrink-0"
                              title={`Remove ${p.name}`}
                              aria-label={`Remove ${p.name}`}
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {!isOpen && (
                    <p className="mt-1 text-xs text-gray-500 tabular-nums">
                      {statsFor(p)
                        .filter((s) => p[s.field] > 0)
                        .map((s) => `${s.icon} ${p[s.field]}`)
                        .join("  ·  ") || "No stats yet"}
                    </p>
                  )}
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* A keeper is judged on saves, not goals and assists — but
                          anything they have recorded still shows. */}
                      {statsFor(p).map((s) => (
                        <div
                          key={s.field}
                          className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <p className="text-xs font-medium text-gray-500 mb-1.5 truncate">
                            {s.icon} {s.label}
                          </p>
                          {editing ? (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => bump(p, s.field, -1)}
                                disabled={p[s.field] === 0}
                                className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none hover:border-green-400 hover:text-green-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                aria-label={`Decrease ${s.label} for ${p.name}`}
                              >
                                −
                              </button>
                              <span className="min-w-[1.5rem] text-center text-lg font-extrabold text-gray-900 tabular-nums">
                                {p[s.field]}
                              </span>
                              <button
                                onClick={() => bump(p, s.field, 1)}
                                className="h-8 w-8 rounded-lg bg-green-600 text-white font-bold text-lg leading-none hover:bg-green-700 cursor-pointer"
                                aria-label={`Increase ${s.label} for ${p.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <p className="text-center text-lg font-extrabold text-gray-900 tabular-nums">
                              {p[s.field]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Season management */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-600">⚙️ End of Season</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Current season: <span className="font-semibold">{season}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setShowSeason((v) => !v);
                setNewSeason(nextSeasonName(season));
                setSeasonError(null);
              }}
              className="text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer whitespace-nowrap"
            >
              {showSeason ? "Cancel" : "Archive & Reset…"}
            </button>
          </div>

          {showSeason && (
            <form onSubmit={endSeason} className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-3">
                Saves {season} to the archive below, then resets every player&apos;s tallies
                to zero. Squads are kept.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newSeason}
                  onChange={(e) => setNewSeason(e.target.value)}
                  placeholder="New season, e.g. 2027/28"
                  aria-label="New season name"
                  className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  type="submit"
                  disabled={!newSeason.trim() || archiving}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {archiving ? "Archiving…" : "Archive & Reset"}
                </button>
              </div>
            </form>
          )}

          {seasonError && <p className="text-sm text-red-600 mt-3">{seasonError}</p>}

          {archives.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Past Seasons</p>
              <div className="flex flex-col gap-2">
                {archives.map((a) => (
                  <div key={a.id} className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className="text-sm font-bold text-gray-900 truncate">{a.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {a.playerCount} player{a.playerCount === 1 ? "" : "s"} ·{" "}
                      {a.matchCount ?? 0} game{(a.matchCount ?? 0) === 1 ? "" : "s"} ·
                      archived {formatDate(a.archivedAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link
                        href={`/admin/stats/presentation${keyQuery(key, `archive=${a.id}`)}`}
                        className="text-xs font-semibold text-green-700 hover:text-green-800 whitespace-nowrap"
                        title={`Present the ${a.name} awards`}
                      >
                        🎬 Present
                      </Link>
                      <button
                        onClick={() => exportArchive(a)}
                        disabled={busyId === a.id}
                        className="text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                        title={`Download ${a.name} stats as a CSV`}
                      >
                        {busyId === a.id ? "…" : "⬇ CSV"}
                      </button>
                      <button
                        onClick={() => restoreArchive(a)}
                        disabled={busyId === a.id}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                        title={`Put ${a.name} back as the live season`}
                      >
                        ↩ Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
