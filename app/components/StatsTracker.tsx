"use client";

import Link from "next/link";
import { backOr } from "@/lib/back";
import { useEffect, useState, useCallback } from "react";
import { useTeams } from "./ClubProvider";
import { nameOf, type Team } from "@/lib/teams";
import { useMyTeam } from "@/lib/myTeam";
import { approachingMilestones, reachedMilestones } from "@/lib/milestones";
import {
  isKeeperStat,
  positionLabel,
  statsForPlayer,
  statsForSquad,
} from "@/lib/positions";
import { cleanSheetCount, playedCount } from "@/lib/cleanSheets";
import { countsTowardsRecord, outcome, seasonRecord } from "@/lib/record";
import type { Position } from "@/lib/statsStorage";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { ICONS, TopBar, useScreens } from "./SettingsUI";

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
/** A player's photo (Members → profile; only coaches and their family can load it), or their initial. */
function PlayerAvatar({ player, version, adminKey }: { player: Player; version?: string; adminKey: string }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-green-50 text-sm font-bold text-green-800 dark:bg-green-400/10 dark:text-green-300">
      {version ? (
        // eslint-disable-next-line @next/next/no-img-element -- a child's photo, private to the club's coaches and their family
        <img src={`/api/players/photo?id=${encodeURIComponent(player.id)}&key=${encodeURIComponent(adminKey)}&v=${version}`} alt="" className="h-full w-full object-cover" />
      ) : (
        player.name.trim().slice(0, 1)
      )}
    </span>
  );
}

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
      <span className="min-w-0 flex-1 truncate text-[17px] font-bold text-gray-900 dark:text-gray-50">{title}</span>
      {summary && !open && (
        <span className="shrink-0 text-xs text-gray-400">{summary}</span>
      )}
      <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
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
  const { TEAMS, teamName } = useTeams();
  const { screen, open, switchTo, close } = useScreens("/admin/stats");
  const playerId = screen.startsWith("player-") ? screen.slice(7) : "";
  const view = playerId || screen === "add" ? "players" : ["players", "awards", "season", "totals"].includes(screen) ? screen : "team";
  const detail = !!playerId || ["add", "season", "totals"].includes(screen);
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  // player id → photo version, for those with a photo (Members → profile)
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
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
  // Summary panels retain their expanded state when switching views.
  const [cardOpen, setCardOpen] = useState<Record<string, boolean>>({});
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
      setPhotos(data.photos ?? {});
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
      Promise.resolve(load(urlKey)).finally(() => setChecking(false));
    } else {
      // signed in with an account, or the coach password given earlier: no password box
      accountKey()
        .then(async (k) => {
          if (k) {
            setKey(k);
            await load(k);
          }
        })
        .finally(() => setChecking(false));
    }
  }, [load]);
  // a coach password that worked here opens every other tool too
  useEffect(() => {
    if (authed) rememberCoachKey(key);
  }, [authed, key]);
  useEffect(() => {
    setEditing(false);
    setEditingId(null);
  }, [screen, team]);
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
      if (!res.ok || !data.saved) throw new Error(data.error ?? "Could not save player. Please try again.");
      setPlayers((prev) => [...prev, data.player]);
      setName("");
      setQuery("");
      open(`player-${data.player.id}`);
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
        if (!res.ok || !data.saved) throw new Error(data.error ?? `Could not save ${playerName}`);
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
    if (busyId) return;
    const next = Math.max(0, p[field] + delta);
    if (next === p[field]) return;
    setBusyId(p.id);
    setError(null);
    setPlayers((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, [field]: next } : x))
    );
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, [field]: next }),
      });
      if (!res.ok || !(await res.json()).success) throw new Error();
    } catch {
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, [field]: p[field] } : x))
      );
      setError("Could not save that correction. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  // Switch a player between outfield and goalkeeper. Nothing is lost either
  // way: the tallies all stay on the record, the card just shows the ones that
  // matter for the position (plus anything they have already recorded).
  async function togglePosition(p: Player) {
    if (busyId) return;
    setBusyId(p.id);
    setError(null);
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
      if (!res.ok || !(await res.json()).success) throw new Error();
    } catch {
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, position: p.position } : x))
      );
      setError("Could not save the position. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveName(p: Player) {
    if (busyId) return;
    const trimmed = editingName.trim();
    setEditingId(null);
    if (!trimmed || trimmed === p.name) return;
    setBusyId(p.id);
    setError(null);
    setPlayers((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, name: trimmed } : x))
    );
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, name: trimmed }),
      });
      if (!res.ok || !(await res.json()).success) throw new Error();
    } catch {
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, name: p.name } : x))
      );
      setError("Could not save the name. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePlayer(p: Player) {
    if (busyId) return;
    if (!confirm(`Remove ${p.name} and their stats?`)) return;
    setBusyId(p.id);
    setError(null);
    try {
      const response = await fetch(`/api/stats?key=${encodeURIComponent(key)}&id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      setPlayers((prev) => prev.filter((x) => x.id !== p.id));
      setEditing(false);
      open("players");
    } catch {
      setError("Could not remove the player. Please try again.");
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
      setMatches([]);
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
      const matchResponse = await fetch(`/api/stats/matches?key=${encodeURIComponent(key)}`).catch(() => null);
      setMatches(matchResponse?.ok ? (await matchResponse.json()).matches ?? [] : []);
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
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">📊</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Stats Tracker</h1>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3 dark:text-gray-50 dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center dark:text-red-400">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Loading…" : "Open stats"}
          </button>
          <Link
            href="/" onClick={backOr}
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400"
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
  const filtered = shown.filter((player) => `${player.name} ${positionLabel(player.position)}`.toLowerCase().includes(query.toLowerCase()));
  const selectedPlayer = shown.find((player) => player.id === playerId);

  // What the match log already holds for this team, so the card below says
  // something true about this season rather than only pointing at another page.
  const todayStr = today();
  const teamGames = matches.filter((m) => m.team === team);
  const nextGame = teamGames
    .filter((m) => !m.resultLogged && m.date >= todayStr)
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
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      {detail ? <TopBar title={selectedPlayer?.name ?? (playerId ? "Player Details" : screen === "add" ? "Add Players" : screen === "totals" ? "Squad Totals" : "Season Management")} onBack={() => { setEditing(false); setEditingId(null); setError(null); close(); }} /> : <TopBar title="Stats Tracker" href={`/admin${keyQuery(key)}`} />}

      <div className="mx-auto max-w-2xl px-4 py-4">
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{error}</p>}
        {!detail && <div className="mb-4 flex items-center gap-3">
          <label className="min-w-0 flex-1"><span className="sr-only">Team</span><select disabled={!!busyId || adding || archiving} value={team} onChange={(event) => { setTeam(event.target.value); setEditing(false); setEditingId(null); setQuery(""); setError(null); }} className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50">{TEAMS.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}</select></label>
          <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">{season}</span>
        </div>}
        {!detail && <div role="tablist" aria-label="Stats views" className="mb-6 grid grid-cols-3 border-b border-gray-200 dark:border-white/15">
          {(["team", "players", "awards"] as const).map((tab) => <button key={tab} role="tab" id={`stats-tab-${tab}`} aria-controls="stats-panel" tabIndex={view === tab ? 0 : -1} aria-selected={view === tab} onClick={() => { setEditing(false); setEditingId(null); setError(null); switchTo(tab); }} onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const tabs = ["team", "players", "awards"];
            const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
            switchTo(tabs[index]); document.getElementById(`stats-tab-${tabs[index]}`)?.focus();
          }} className={`min-h-12 border-b-2 text-sm font-semibold capitalize ${view === tab ? "border-green-700 text-green-700 dark:border-green-400 dark:text-green-400" : "border-transparent text-gray-500 dark:text-gray-400"}`}>{tab}</button>)}
        </div>}

        <div id="stats-panel" role={detail ? undefined : "tabpanel"} aria-labelledby={detail ? undefined : `stats-tab-${view}`}>
        <section hidden={view !== "team"} className="mb-5">
          <div className="mb-5 flex items-end justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Season overview</p><h2 className="mt-1 break-words text-2xl font-bold text-gray-900 dark:text-gray-50">{teamName(team)}</h2></div><span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{shown.length} player{shown.length === 1 ? "" : "s"}</span></div>
          {nextGame && <Link href={`/admin/stats/matches${keyQuery(key)}`} className="mb-4 flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-[#1c1c1e]"><span className="text-green-700 dark:text-green-400">{ICONS.doc}</span><span className="min-w-0 flex-1"><span className="block text-xs text-gray-500 dark:text-gray-400">Next match</span><span className="block break-words text-sm font-semibold text-gray-900 dark:text-gray-50">{nextGame.home ? "v" : "Away at"} {nextGame.opponent}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{formatFixture(nextGame.date)}</span></span><span aria-hidden="true" className="text-gray-400">›</span></Link>}
          <div className="grid grid-cols-2 gap-3"><Link href={`/admin/stats/matches${keyQuery(key)}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-3 text-sm font-semibold text-white">{ICONS.doc}Match Log</Link><Link href={`/admin/stats/training${keyQuery(key)}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-green-700 shadow-sm dark:bg-[#1c1c1e] dark:text-green-400">{ICONS.team}Training Log</Link></div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{loggedGames} result{loggedGames === 1 ? "" : "s"} logged</p>
          {needScore > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">{needScore} result{needScore === 1 ? "" : "s"} awaiting a score</p>}
        </section>

        {/* Add player — only while editing */}
        {screen === "add" && (
        <form
          onSubmit={bulk ? addMany : addPlayer}
          className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[17px] font-bold text-gray-900 dark:text-gray-50">
              Add {bulk ? "Players" : "a Player"} to {teamName(team)}
            </p>
            <button
              type="button"
              disabled={adding}
              onClick={() => {
                setBulk((v) => !v);
                setBulkResult(null);
                setError(null);
              }}
              className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer whitespace-nowrap dark:text-green-400"
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
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
                aria-label="Player name"
                className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
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
            <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-400">{bulkResult}</p>
          )}
          {error && <p className="text-sm text-red-600 mt-3 dark:text-red-400">{error}</p>}
        </form>
        )}

        {/* ── Team stats ──────────────────────────────────────────────────
            How the team has done: its record and its clean sheets, counted in
            games off the match log. Nothing here belongs to a player, and
            nothing below it belongs to the team. */}
        <h2 hidden={view !== "team"} className="mb-2.5 text-lg font-bold text-gray-900 dark:text-gray-50">Team Record</h2>
        <div hidden={view !== "team"} className="mb-6 border-y border-gray-200 py-4 dark:border-white/15">
          {gamesPlayed === 0 ? (
            <p className="text-sm text-gray-400">
              No games logged yet — add them in the match log and the record fills
              in.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[17px] font-bold text-gray-900 dark:text-gray-50">League Record</p>
                {form.length > 0 && (
                  <div className="flex items-center gap-1">
                    {form.map((f, i) => (
                      <span
                        key={i}
                        className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-white ${
                          f === "W" ? "bg-green-600" : f === "D" ? "bg-amber-500" : "bg-red-600"
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
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                        <th key={h} className="px-1 py-1 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-extrabold tabular-nums text-gray-900 dark:text-gray-50">
                      <td className="px-1 py-1">{record.played}</td>
                      <td className="px-1 py-1 text-green-700 dark:text-green-400">{record.won}</td>
                      <td className="px-1 py-1">{record.drawn}</td>
                      <td className="px-1 py-1 text-red-600 dark:text-red-400">{record.lost}</td>
                      <td className="px-1 py-1">{record.scored}</td>
                      <td className="px-1 py-1">{record.conceded}</td>
                      <td className="px-1 py-1">
                        {record.difference > 0 ? "+" : ""}
                        {record.difference}
                      </td>
                      <td className="px-1 py-1 text-green-700 dark:text-green-400">{record.points}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Clean sheets are counted across every game, cup and friendly
                  included, while the table above is league games only. */}
              {/* Worded exactly as the match log words it, so the same number
                  reads the same way in both places. */}
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-white/10">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-extrabold tabular-nums text-gray-900 dark:text-gray-50">
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
        {view === "awards" && <Link href={`/admin/awards${keyQuery(key)}`} className="mb-5 flex min-h-16 items-center gap-3 rounded-lg bg-white p-4 text-sm font-semibold text-gray-900 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-50"><span className="text-amber-700 dark:text-amber-400">{ICONS.crest}</span><span className="min-w-0 flex-1">Parents&apos; Season Awards</span><span aria-hidden="true" className="text-gray-400">›</span></Link>}
        {view === "awards" && !shown.length && <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No player awards yet.</p>}

        {shown.length > 0 && (
          <>
            {/* Squad totals — the sum of the players' own tallies */}
            <div hidden={view !== "totals"} className="mb-4 rounded-lg bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
              <FoldHeader
                title="Squad Totals"
                open={cardIsOpen("totals")}
                onToggle={() => toggleCard("totals")}
              />
              {cardIsOpen("totals") && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {totals.map((t) => (
                    <div key={t.field} className="rounded-xl bg-gray-50 px-2 py-2 text-center dark:bg-white/5">
                      <p className="text-lg font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
                        {t.total}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate dark:text-gray-400">
                        <span aria-hidden="true">{t.icon}</span> {t.short}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Milestones */}
            {(reached.length > 0 || approaching.length > 0) && (
              <div hidden={view !== "awards"} className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
                <FoldHeader
                  title="Milestones"
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
                        className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-300"
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
                          className="rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300"
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
            <div hidden={view !== "awards"} className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
              <FoldHeader
                title={`${season} Awards`}
                open={cardIsOpen("awards")}
                onToggle={() => toggleCard("awards")}
              />
              {!cardIsOpen("awards") ? null : hasAwards ? (
                <div className="mt-3 flex flex-col gap-2">
                  {awards.map((a) =>
                    a.result ? (
                      <div
                        key={a.field}
                        className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5"
                      >
                        <span className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400"><span aria-hidden="true">{a.icon}</span> {a.label}</span>
                        <span className="min-w-0 flex-1 break-words text-right text-sm font-bold text-gray-900 dark:text-gray-50">
                          {a.result.names.join(", ")}
                        </span>
                        <span className="text-sm font-extrabold text-green-700 tabular-nums shrink-0 dark:text-green-400">
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

        <section hidden={view !== "players" || screen === "add"}>
        {!playerId && <>
          <div className="mb-4 flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Search players</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players" className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50" /></label><label className="w-36 shrink-0"><span className="sr-only">Sort players</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as "name" | StatField)} className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50"><option value="name">Name (A-Z)</option>{STATS.filter((stat) => squadFields.has(stat.field)).map((stat) => <option key={stat.field} value={stat.field}>{stat.short}</option>)}</select></label></div>
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} player{filtered.length === 1 ? "" : "s"}</p><button onClick={() => { setBulk(false); setBulkResult(null); setError(null); open("add"); }} className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">Add Players</button></div>
        </>}
        {selectedPlayer && <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-gray-500 dark:text-gray-400">{positionLabel(selectedPlayer.position)}</p><button disabled={!!busyId} onClick={() => { setEditing((current) => !current); setEditingId(null); }} className="flex min-h-11 items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{ICONS.doc}{editing ? "Done" : "Correct Stats"}</button></div>}

        {!playerId ? (
          filtered.length ? <div className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">{filtered.map((player) => <button key={player.id} onClick={() => { setEditing(false); setEditingId(null); setError(null); open(`player-${player.id}`); }} className="flex min-h-19 w-full items-center gap-3 px-4 py-3 text-left"><PlayerAvatar player={player} version={photos[player.id]} adminKey={key} /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-gray-900 dark:text-gray-50">{player.name}</span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{positionLabel(player.position)}</span><span className="mt-1 block text-xs tabular-nums text-gray-500 dark:text-gray-400">{statsFor(player).filter((stat) => player[stat.field] > 0).map((stat) => `${stat.icon} ${stat.short} ${player[stat.field]}`).join(" · ") || "No stats yet"}</span></span><span aria-hidden="true" className="shrink-0 text-gray-400">›</span></button>)}</div> : <p role="status" className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{query ? "No players match your search." : "No players in this team yet."}</p>
        ) : !selectedPlayer ? (
          <p role="status" className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">This player is not in the selected team.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[selectedPlayer].map((p) => {
              return (
                <div
                  key={p.id}
                  className="rounded-lg bg-white p-4 shadow-sm dark:bg-[#1c1c1e]"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
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
                          aria-label={`Rename ${p.name}`}
                          className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
                        />
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => saveName(p)}
                          className="text-xs font-bold text-green-700 hover:text-green-800 cursor-pointer shrink-0 dark:text-green-400"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="min-h-11 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Cancel</button>
                      </>
                    ) : (
                      <>
                        <p className="min-w-0 flex-1 break-words font-bold text-gray-900 dark:text-gray-50">
                          {p.name}
                        </p>
                        {editing ? (
                          <button
                            onClick={() => togglePosition(p)}
                            disabled={!!busyId}
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                              p.position === "goalkeeper"
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-500 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/40"
                                : "border-gray-200 bg-white text-gray-500 hover:border-green-400 hover:text-green-700 dark:bg-[#1c1c1e] dark:text-gray-400 dark:border-white/15"
                            }`}
                            title={`${p.name} is ${
                              p.position === "goalkeeper" ? "a goalkeeper" : "outfield"
                            } — tap to switch`}
                          >
                            {positionLabel(p.position)}
                          </button>
                        ) : (
                          p.position === "goalkeeper" && (
                            <span
                              className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"
                              title="Goalkeeper"
                            >
                              GK
                            </span>
                          )
                        )}
                        {editing && (
                          <>
                            <button
                              disabled={!!busyId}
                              onClick={() => {
                                setEditingId(p.id);
                                setEditingName(p.name);
                              }}
                              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-green-700 dark:hover:bg-white/10"
                              title={`Rename ${p.name}`}
                              aria-label={`Rename ${p.name}`}
                            >
                              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m14 6 4 4" /></svg>
                            </button>
                            <button
                              onClick={() => removePlayer(p)}
                              disabled={!!busyId}
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
                  {(
                    <div className="grid grid-cols-2 gap-2">
                      {/* A keeper is judged on saves, not goals and assists — but
                          anything they have recorded still shows. */}
                      {statsFor(p).map((s) => (
                        <div
                          key={s.field}
                          className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:bg-white/5 dark:border-white/10"
                        >
                          <p className="text-xs font-medium text-gray-500 mb-1.5 truncate dark:text-gray-400">
                            <span aria-hidden="true">{s.icon}</span> {s.label}
                          </p>
                          {editing ? (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => bump(p, s.field, -1)}
                                disabled={p[s.field] === 0 || !!busyId}
                                className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none hover:border-green-400 hover:text-green-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer dark:bg-[#1c1c1e] dark:text-gray-300 dark:border-white/15"
                                aria-label={`Decrease ${s.label} for ${p.name}`}
                              >
                                −
                              </button>
                              <span className="min-w-[1.5rem] text-center text-lg font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
                                {p[s.field]}
                              </span>
                              <button
                                onClick={() => bump(p, s.field, 1)}
                                disabled={!!busyId}
                                className="h-8 w-8 rounded-lg bg-green-600 text-white font-bold text-lg leading-none hover:bg-green-700 cursor-pointer"
                                aria-label={`Increase ${s.label} for ${p.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <p className="text-center text-lg font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
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

        </section>
        {view === "team" && shown.length > 0 && <button onClick={() => open("totals")} className="mt-4 flex min-h-11 w-full items-center justify-between text-sm font-semibold text-gray-500 dark:text-gray-400">Squad totals<span aria-hidden="true">›</span></button>}
        {view === "team" && <button onClick={() => open("season")} className="mt-4 flex min-h-11 w-full items-center justify-between text-sm font-semibold text-gray-500 dark:text-gray-400">Season management<span aria-hidden="true">›</span></button>}

        {/* Season management */}
        <div hidden={view !== "season"} className="rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
          <div className="mb-5 flex flex-wrap items-center gap-3"><button disabled={!shown.length} onClick={() => downloadTeamCSV(shown, team)} className="flex min-h-11 items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{ICONS.share}Export CSV</button><Link href={`/admin/stats/presentation${keyQuery(key, `team=${encodeURIComponent(team)}`)}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900 dark:border-white/15 dark:text-gray-50">{ICONS.doc}Presentation</Link></div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[17px] font-bold text-gray-900 dark:text-gray-50">End of Season</p>
              <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
                Current season: <span className="font-semibold">{season}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setShowSeason((v) => !v);
                setNewSeason(nextSeasonName(season));
                setSeasonError(null);
              }}
              className="text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer whitespace-nowrap dark:text-green-400"
            >
              {showSeason ? "Cancel" : "Archive & Reset…"}
            </button>
          </div>

          {showSeason && (
            <form onSubmit={endSeason} className="mt-4 border-t border-gray-100 pt-4 dark:border-white/10">
              <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
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
                  className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
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

          {seasonError && <p className="text-sm text-red-600 mt-3 dark:text-red-400">{seasonError}</p>}

          {archives.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/10">
              <p className="text-xs font-semibold text-gray-500 mb-2 dark:text-gray-400">Past Seasons</p>
              <div className="flex flex-col gap-2">
                {archives.map((a) => (
                  <div key={a.id} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                    <p className="text-sm font-bold text-gray-900 truncate dark:text-gray-50">{a.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {a.playerCount} player{a.playerCount === 1 ? "" : "s"} ·{" "}
                      {a.matchCount ?? 0} game{(a.matchCount ?? 0) === 1 ? "" : "s"} ·
                      archived {formatDate(a.archivedAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link
                        href={`/admin/stats/presentation${keyQuery(key, `archive=${a.id}`)}`}
                        className="text-xs font-semibold text-green-700 hover:text-green-800 whitespace-nowrap dark:text-green-400"
                        title={`Present the ${a.name} awards`}
                      >
                        Present
                      </Link>
                      <button
                        onClick={() => exportArchive(a)}
                        disabled={busyId === a.id}
                        className="text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-40 cursor-pointer whitespace-nowrap dark:text-green-400"
                        title={`Download ${a.name} stats as a CSV`}
                      >
                        {busyId === a.id ? "…" : "CSV"}
                      </button>
                      <button
                        onClick={() => restoreArchive(a)}
                        disabled={busyId === a.id}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-40 cursor-pointer whitespace-nowrap dark:text-amber-300"
                        title={`Put ${a.name} back as the live season`}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
