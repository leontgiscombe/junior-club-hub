"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useTeams } from "./ClubProvider";
import { useMyTeam } from "@/lib/myTeam";
import FaSync from "./FaSync";
import { countsTowardsRecord, outcome, seasonRecord } from "@/lib/record";
import { cleanSheetCount, isCleanSheet, playedCount } from "@/lib/cleanSheets";

interface Player {
  id: string;
  team: string;
  name: string;
  goals: number;
  assists: number;
}

interface GoalEvent {
  id: string;
  scorerId: string;
  assistId: string;
}

interface Match {
  id: string;
  team: string;
  opponent: string;
  date: string;
  time: string;
  home: boolean;
  goals: GoalEvent[];
  opponentGoals: number;
  friendly: boolean;
  cup: boolean;
  appearanceIds: string[];
  potmId: string;
  mostImprovedId: string;
  resultLogged: boolean;
  createdAt: string;
}

// A fixture's details, as opposed to what happened in it — what the add form
// collects and what Edit can change afterwards.
interface Fixture {
  opponent: string;
  date: string;
  time: string;
  home: boolean;
  friendly: boolean;
  cup: boolean;
}

type GameType = "league" | "friendly" | "cup";

// League, friendly or cup — friendlies and cups both stay out of the league
// record (friendly: true); cup tells the two apart.
function gameType(g: { friendly: boolean; cup: boolean }): GameType {
  return !g.friendly ? "league" : g.cup ? "cup" : "friendly";
}

function fromGameType(type: string) {
  return { friendly: type !== "league", cup: type === "cup" };
}

function GameTypeOptions() {
  return (
    <>
      <option value="league">🏆 League Game</option>
      <option value="cup">🥇 Cup Game</option>
      <option value="friendly">🤝 Friendly</option>
    </>
  );
}

// Per-game awards, each feeding the matching season tally.
const AWARDS: {
  field: "potmId" | "mostImprovedId";
  action: string;
  label: string;
  icon: string;
}[] = [
  { field: "potmId", action: "set-potm", label: "Player of the Match", icon: "🏆" },
  {
    field: "mostImprovedId",
    action: "set-most-improved",
    label: "Most Improved",
    icon: "📈",
  },
];


function formatDate(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function MatchLog() {
  const { TEAMS, teamName, teamAccent, findTeam } = useTeams();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  // opens on the team last picked on this device (see lib/myTeam.ts)
  const [team, setTeam] = useMyTeam();

  // add-match form
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  // kick-off time, optional — shown in the camera register
  const [time, setTime] = useState("");
  const [home, setHome] = useState(true);
  // a friendly or cup game — logged, but kept out of the league record
  const [friendly, setFriendly] = useState(false);
  const [cup, setCup] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // the fixture being edited, and the details being typed into it
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Fixture>({
    opponent: "",
    date: "",
    time: "",
    home: true,
    friendly: false,
    cup: false,
  });

  // per-match "add goal" pickers, keyed by match id
  const [scorerFor, setScorerFor] = useState<Record<string, string>>({});
  const [assistFor, setAssistFor] = useState<Record<string, string>>({});
  // fixtures still to come stay compact until you open one up to log goals
  const [expanded, setExpanded] = useState<string[]>([]);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, matchRes] = await Promise.all([
        fetch(`/api/stats?key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/stats/matches?key=${encodeURIComponent(adminKey)}`),
      ]);
      if (statsRes.status === 401 || matchRes.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!statsRes.ok || !matchRes.ok) throw new Error("Failed to load");
      const stats = await statsRes.json();
      const matchData = await matchRes.json();
      setPlayers(stats.players ?? []);
      setMatches(matchData.matches ?? []);
      setAuthed(true);
    } catch {
      setError("Could not load the match log. Please try again.");
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
    }
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const squad = players
    .filter((p) => p.team === team)
    .sort((a, b) => a.name.localeCompare(b.name));
  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Removed player";

  async function addMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!opponent.trim() || !date || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats/matches?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, opponent, date, time, home, friendly, cup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the match");
      setMatches((prev) => [...prev, data.match]);
      setOpponent("");
      setDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the match");
    } finally {
      setAdding(false);
    }
  }

  // Returns whether it saved, so a form can stay open when it didn't.
  async function patch(matchId: string, body: Record<string, unknown>): Promise<boolean> {
    setBusyId(matchId);
    setError(null);
    try {
      const res = await fetch(`/api/stats/matches?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't save");
      setMatches((prev) => prev.map((m) => (m.id === matchId ? data.match : m)));
      if (data.players) setPlayers(data.players);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  // Fixtures change through the season — a cup tie displaces a league game, a
  // kick-off moves, a home game is switched. Editing one leaves everything
  // already logged against it (goals, awards, who played) exactly as it is.
  function startEdit(match: Match) {
    setError(null);
    setEditingId(match.id);
    setDraft({
      opponent: match.opponent,
      date: match.date,
      time: match.time ?? "",
      home: match.home,
      friendly: match.friendly,
      cup: match.cup ?? false,
    });
  }

  async function saveEdit(match: Match) {
    if (!draft.opponent.trim() || !draft.date || busyId === match.id) return;
    const saved = await patch(match.id, {
      action: "edit",
      ...draft,
      opponent: draft.opponent.trim(),
    });
    // Keep the form open on a failure, so nothing typed is lost.
    if (saved) setEditingId(null);
  }

  async function addGoal(match: Match) {
    const scorerId = scorerFor[match.id] ?? "";
    if (!scorerId) return;
    await patch(match.id, {
      action: "add-goal",
      scorerId,
      assistId: assistFor[match.id] ?? "",
    });
    setScorerFor((prev) => ({ ...prev, [match.id]: "" }));
    setAssistFor((prev) => ({ ...prev, [match.id]: "" }));
  }

  async function removeMatch(match: Match) {
    if (
      !confirm(
        `Remove ${teamName(match.team)} v ${match.opponent}?\n\n` +
          `Its ${match.goals.length} goal${match.goals.length === 1 ? "" : "s"} will be ` +
          `taken back off the players' season totals.`
      )
    ) {
      return;
    }
    setBusyId(match.id);
    try {
      const res = await fetch(
        `/api/stats/matches?key=${encodeURIComponent(key)}&id=${match.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove the match");
      setMatches((prev) => prev.filter((m) => m.id !== match.id));
      if (data.players) setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the match");
    } finally {
      setBusyId(null);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">⚽</div>
            <h1 className="text-xl font-extrabold text-gray-900">Match Log</h1>
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
            {loading ? "Loading…" : "Open match log"}
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

  const leagueOpponents = findTeam(team)?.opponents ?? [];
  // While editing a league fixture, offer this team's league sides — plus
  // whoever the game is currently against if they are not on that list, so
  // switching a cup tie back to a league game never loses the opponent.
  const editOpponents =
    draft.friendly || leagueOpponents.length === 0
      ? []
      : !draft.opponent || leagueOpponents.includes(draft.opponent)
        ? leagueOpponents
        : [draft.opponent, ...leagueOpponents];
  const shown = matches.filter((m) => m.team === team);
  // The team's clean sheets, across every game it has played — a cup clean
  // sheet is still a clean sheet, even though cup games stay out of the
  // league table.
  const teamCleanSheets = cleanSheetCount(shown);
  const playedGames = playedCount(shown);

  // A fixture counts as played once anything is recorded against it, or once
  // its date has passed — so a whole season can be added up front without
  // every unplayed fixture reading as a 0–0 draw.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
  const isPlayed = (m: Match) =>
    m.goals.length > 0 || m.opponentGoals > 0 || m.date < todayStr;

  // Next game first for what's coming; most recent first for what's done.
  const upcoming = shown
    .filter((m) => !isPlayed(m))
    .sort((a, b) => a.date.localeCompare(b.date));
  const results = shown
    .filter(isPlayed)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Friendlies and cup games are logged, but kept out of the league record.
  const logged = results.filter(countsTowardsRecord);
  const record = seasonRecord(logged);
  const awaiting = results.length - logged.length;
  // Most recent five results, oldest of those first so form reads left to right.
  const form = logged.slice(0, 5).reverse().map(outcome);

  // Who sets up whom: count assist → scorer pairs across this team's matches.
  const pairs = new Map<string, number>();
  for (const match of shown) {
    for (const goal of match.goals) {
      if (!goal.assistId) continue;
      const combo = `${goal.assistId}|${goal.scorerId}`;
      pairs.set(combo, (pairs.get(combo) ?? 0) + 1);
    }
  }
  const topPairs = [...pairs.entries()]
    .map(([combo, count]) => {
      const [assistId, scorerId] = combo.split("|");
      return { assistId, scorerId, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-700 px-4 py-6 text-white">
        <Link
          href={`/admin/stats?key=${encodeURIComponent(key)}`}
          className="text-sm font-medium text-green-200 hover:text-white"
        >
          ← Stats Tracker
        </Link>
        <h1 className="text-xl font-extrabold mt-2">⚽ Match Log</h1>
        <p className="text-green-200 text-sm mt-0.5">
          Log each game&apos;s goals and who assisted — season totals update automatically
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Team tabs */}
        <div className="flex gap-2 mb-5">
          {TEAMS.map((t) => (
            <button
              key={t.slug}
              onClick={() => {
                // Each team has its own league list, so start the opponent fresh.
                setTeam(t.slug);
                setOpponent("");
              }}
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

        {/* Our record so far — shown as soon as the team has any games, so the
            table is findable before the first result is in */}
        {shown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-600">
                🏆 {teamName(team)} league record
              </p>
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
                    <th className="px-1 py-1 font-semibold">P</th>
                    <th className="px-1 py-1 font-semibold">W</th>
                    <th className="px-1 py-1 font-semibold">D</th>
                    <th className="px-1 py-1 font-semibold">L</th>
                    <th className="px-1 py-1 font-semibold">GF</th>
                    <th className="px-1 py-1 font-semibold">GA</th>
                    <th className="px-1 py-1 font-semibold">GD</th>
                    <th className="px-1 py-1 font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-extrabold text-gray-900 tabular-nums">
                    <td className="px-1 py-1">{record.played}</td>
                    <td className="px-1 py-1 text-green-700">{record.won}</td>
                    <td className="px-1 py-1">{record.drawn}</td>
                    <td className="px-1 py-1 text-red-500">{record.lost}</td>
                    <td className="px-1 py-1">{record.scored}</td>
                    <td className="px-1 py-1">{record.conceded}</td>
                    <td className="px-1 py-1">
                      {record.difference > 0 ? `+${record.difference}` : record.difference}
                    </td>
                    <td className="px-1 py-1 text-green-700">{record.points}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* A clean sheet belongs to the team, so it is counted in games
                here rather than against each player's name. Cup and friendly
                games count towards it as much as league ones. */}
            {playedGames > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                🥅{" "}
                <span className="font-semibold">
                  {teamCleanSheets} clean sheet{teamCleanSheets === 1 ? "" : "s"}
                </span>{" "}
                in {playedGames} game{playedGames === 1 ? "" : "s"} played
              </p>
            )}
            {record.played === 0 && (
              <p className="mt-2 text-xs text-gray-400">
                No league results logged yet — add a game&apos;s score below and this
                fills in.
              </p>
            )}
            {awaiting > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                {awaiting} past game{awaiting === 1 ? "" : "s"} not counted yet — add
                the score, or confirm a 0–0, below.
              </p>
            )}
          </div>
        )}

        {/* Fixtures kept in step with FA Full-Time, for teams with a snippet */}
        <FaSync<Match> team={team} adminKey={key} onMatches={setMatches} />

        {/* Add match */}
        <form
          onSubmit={addMatch}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4"
        >
          <p className="text-sm font-semibold text-gray-600 mb-3">
            ➕ Add a Game for {teamAccent(team)} {teamName(team)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* League or one-off — available to every team */}
            <select
              value={gameType({ friendly, cup })}
              onChange={(e) => {
                const type = fromGameType(e.target.value);
                setFriendly(type.friendly);
                setCup(type.cup);
                setOpponent("");
              }}
              aria-label="Game type"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <GameTypeOptions />
            </select>

            {!friendly && leagueOpponents.length > 0 ? (
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                aria-label="Opponent"
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="">Opponent…</option>
                {leagueOpponents.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Opponent, e.g. City Juniors"
                aria-label="Opponent"
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Kick-off time"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <select
              value={home ? "home" : "away"}
              onChange={(e) => setHome(e.target.value === "home")}
              aria-label="Home or away"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="home">🏠 Home</option>
              <option value="away">🚌 Away</option>
            </select>
            <button
              type="submit"
              disabled={!opponent.trim() || !date || adding}
              className="rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {adding ? "Adding…" : "Add Game"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </form>

        {/* Who sets up whom */}
        {topPairs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">
              🤝 Assist combinations — {teamName(team)}
            </p>
            <div className="flex flex-col gap-2">
              {topPairs.map((p) => (
                <div
                  key={`${p.assistId}|${p.scorerId}`}
                  className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
                >
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-900">
                    {playerName(p.assistId)}{" "}
                    <span className="font-normal text-gray-400">→</span>{" "}
                    {playerName(p.scorerId)}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold text-green-700 tabular-nums">
                    ×{p.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mb-3">
          {shown.length} game{shown.length === 1 ? "" : "s"} for {teamName(team)}
        </p>

        {squad.length === 0 && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Add players to {teamName(team)} on the Stats Tracker first — you pick the
            scorer and assister from the squad.
          </p>
        )}

        {shown.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p>No games yet — add this season&apos;s fixtures above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...upcoming, ...results].map((m, i) => (
              <Fragment key={m.id}>
                {i === 0 && upcoming.length > 0 && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    📅 Upcoming · {upcoming.length}
                  </p>
                )}
                {i === upcoming.length && results.length > 0 && (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    ✅ Results · {results.length}
                  </p>
                )}
                <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-4">
                {editingId === m.id ? (
                  /* Fixtures move — this changes the details without touching
                     any goals, awards or appearances already logged. */
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-600">
                        ✏️ Edit fixture
                      </p>
                      <button
                        onClick={() => setEditingId(null)}
                        className="shrink-0 cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        value={gameType(draft)}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, ...fromGameType(e.target.value) }))
                        }
                        aria-label="Game type"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        <GameTypeOptions />
                      </select>

                      {editOpponents.length > 0 ? (
                        <select
                          value={draft.opponent}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, opponent: e.target.value }))
                          }
                          aria-label="Opponent"
                          className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                          <option value="">Opponent…</option>
                          {editOpponents.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={draft.opponent}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, opponent: e.target.value }))
                          }
                          placeholder="Opponent"
                          aria-label="Opponent"
                          className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      )}

                      <input
                        type="date"
                        value={draft.date}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, date: e.target.value }))
                        }
                        aria-label="Date"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                      <input
                        type="time"
                        value={draft.time}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, time: e.target.value }))
                        }
                        aria-label="Kick-off time"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                      <select
                        value={draft.home ? "home" : "away"}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, home: e.target.value === "home" }))
                        }
                        aria-label="Home or away"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        <option value="home">🏠 Home</option>
                        <option value="away">🚌 Away</option>
                      </select>
                      <button
                        onClick={() => saveEdit(m)}
                        disabled={!draft.opponent.trim() || !draft.date || busyId === m.id}
                        className="rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        {busyId === m.id ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                    {m.goals.length > 0 && (
                      <p className="mt-3 text-xs text-gray-400">
                        The {m.goals.length} goal
                        {m.goals.length === 1 ? "" : "s"} logged against this game stay
                        as they are.
                      </p>
                    )}
                  </div>
                ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">
                      {teamAccent(m.team)} {teamName(m.team)}{" "}
                      {isPlayed(m) ? (
                        <span className="text-green-700">
                          {m.goals.length}–{m.opponentGoals}
                        </span>
                      ) : (
                        <span className="font-normal text-gray-400">v</span>
                      )}{" "}
                      {m.opponent}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {m.home ? "🏠 Home" : "🚌 Away"} · {formatDate(m.date)}
                      {m.time && ` · ${m.time}`}
                      {gameType(m) === "friendly" && (
                        <span className="text-gray-400"> · 🤝 friendly</span>
                      )}
                      {gameType(m) === "cup" && (
                        <span className="text-gray-400"> · 🥇 cup</span>
                      )}
                      {!isPlayed(m) && " · not played yet"}
                      {isPlayed(m) && !m.resultLogged && (
                        <span className="text-amber-700"> · no score logged</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(m)}
                    disabled={busyId === m.id}
                    className="shrink-0 cursor-pointer text-sm leading-none text-gray-300 hover:text-green-600"
                    title="Change the opponent, date, kick-off or venue"
                    aria-label={`Edit ${teamName(m.team)} v ${m.opponent}`}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => removeMatch(m)}
                    disabled={busyId === m.id}
                    className="shrink-0 cursor-pointer text-lg leading-none text-gray-300 hover:text-red-400"
                    title="Remove this game"
                    aria-label={`Remove ${teamName(m.team)} v ${m.opponent}`}
                  >
                    ✕
                  </button>
                </div>
                )}

                {/* Goals */}
                {m.goals.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {m.goals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2"
                      >
                        <span className="shrink-0">⚽</span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {g.scorerId ? (
                            <>
                              <span className="font-bold text-gray-900">
                                {playerName(g.scorerId)}
                              </span>
                              {g.assistId ? (
                                <span className="text-gray-500">
                                  {" "}
                                  · assist {playerName(g.assistId)}
                                </span>
                              ) : (
                                <span className="text-gray-400"> · no assist</span>
                              )}
                            </>
                          ) : (
                            /* Counts towards the score, credited to nobody. */
                            <span className="text-gray-400">Scorer not recorded</span>
                          )}
                        </span>
                        <button
                          onClick={() => patch(m.id, { action: "remove-goal", goalId: g.id })}
                          disabled={busyId === m.id}
                          className="shrink-0 cursor-pointer text-sm leading-none text-gray-300 hover:text-red-400"
                          title="Remove this goal"
                          aria-label={
                            g.scorerId
                              ? `Remove goal by ${playerName(g.scorerId)}`
                              : `Remove unrecorded goal against ${m.opponent}`
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* A fixture still to come stays compact until you open it */}
                {!isPlayed(m) && !expanded.includes(m.id) ? (
                  <button
                    onClick={() => setExpanded((prev) => [...prev, m.id])}
                    className="mt-3 cursor-pointer text-xs font-semibold text-green-700 hover:text-green-800"
                  >
                    ⚽ Log goals
                  </button>
                ) : (
                  <>
                {/* Add a goal */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={scorerFor[m.id] ?? ""}
                    onChange={(e) =>
                      setScorerFor((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    aria-label={`Goal scorer for ${m.opponent}`}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">⚽ Scorer…</option>
                    {squad.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assistFor[m.id] ?? ""}
                    onChange={(e) =>
                      setAssistFor((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    aria-label={`Assist for ${m.opponent}`}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">🅰️ Assist — none</option>
                    {squad
                      .filter((p) => p.id !== (scorerFor[m.id] ?? ""))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => addGoal(m)}
                    disabled={!scorerFor[m.id] || busyId === m.id}
                    className="shrink-0 cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add Goal
                  </button>
                </div>

                {/* A played game with nothing recorded needs confirming before
                    it counts towards the record — it may just be a 0–0. */}
                {isPlayed(m) && !m.resultLogged && (
                  <button
                    onClick={() => patch(m.id, { action: "confirm-result" })}
                    disabled={busyId === m.id}
                    className="mt-3 w-full cursor-pointer rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                  >
                    ✓ Confirm 0–0 (counts it in the record)
                  </button>
                )}

                {/* Who played */}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-gray-500">
                      👟 Who Played ({(m.appearanceIds ?? []).length})
                    </span>
                    <span className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          patch(m.id, {
                            action: "set-appearances",
                            playerIds: squad.map((p) => p.id),
                          })
                        }
                        disabled={busyId === m.id || squad.length === 0}
                        className="cursor-pointer text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-40"
                      >
                        All
                      </button>
                      <button
                        onClick={() =>
                          patch(m.id, { action: "set-appearances", playerIds: [] })
                        }
                        disabled={busyId === m.id || (m.appearanceIds ?? []).length === 0}
                        className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40"
                      >
                        None
                      </button>
                    </span>
                  </div>
                  {squad.length === 0 ? (
                    <p className="text-xs text-gray-400">No players in this team yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {squad.map((p) => {
                        const played = (m.appearanceIds ?? []).includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() =>
                              patch(m.id, {
                                action: "set-appearances",
                                playerIds: played
                                  ? (m.appearanceIds ?? []).filter((id) => id !== p.id)
                                  : [...(m.appearanceIds ?? []), p.id],
                              })
                            }
                            disabled={busyId === m.id}
                            aria-pressed={played}
                            aria-label={`${played ? "Remove" : "Add"} appearance for ${p.name}`}
                            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${
                              played
                                ? "border-green-600 bg-green-600 text-white"
                                : "border-gray-200 bg-white text-gray-600 hover:border-green-400 hover:text-green-700"
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>

                {/* Per-game awards */}
                <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
                  {AWARDS.map((a) => (
                    <div key={a.field} className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-medium text-gray-500">
                        {a.icon} {a.label}
                      </span>
                      <select
                        value={m[a.field] ?? ""}
                        onChange={(e) =>
                          patch(m.id, { action: a.action, playerId: e.target.value })
                        }
                        disabled={busyId === m.id}
                        aria-label={`${a.label} for ${m.opponent}`}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        <option value="">— Not Awarded —</option>
                        {squad.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Our score, for a result written up afterwards: the goals
                    nobody can put a name to still count towards it. */}
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                  <span className="text-xs font-medium text-gray-500">
                    {teamName(m.team)} scored
                  </span>
                  <button
                    onClick={() =>
                      patch(m.id, { action: "our-goals", ourGoals: m.goals.length - 1 })
                    }
                    disabled={
                      busyId === m.id ||
                      m.goals.filter((g) => !g.scorerId).length === 0
                    }
                    className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 bg-white text-base font-bold leading-none text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-30"
                    title={
                      m.goals.filter((g) => !g.scorerId).length === 0
                        ? "Every goal here has a scorer — remove one from the list above"
                        : `Fewer goals for ${teamName(m.team)}`
                    }
                    aria-label={`Fewer goals for ${teamName(m.team)}`}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center font-extrabold text-gray-900 tabular-nums">
                    {m.goals.length}
                  </span>
                  <button
                    onClick={() =>
                      patch(m.id, { action: "our-goals", ourGoals: m.goals.length + 1 })
                    }
                    disabled={busyId === m.id}
                    className="h-7 w-7 cursor-pointer rounded-lg bg-green-600 text-base font-bold leading-none text-white hover:bg-green-700 disabled:opacity-40"
                    aria-label={`More goals for ${teamName(m.team)}`}
                    title="Adds a goal with no scorer recorded — name it above if you remember"
                  >
                    +
                  </button>
                </div>

                {/* Opponent score */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {m.opponent} scored
                  </span>
                  <button
                    onClick={() =>
                      patch(m.id, {
                        action: "opponent-goals",
                        opponentGoals: m.opponentGoals - 1,
                      })
                    }
                    disabled={m.opponentGoals === 0 || busyId === m.id}
                    className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 bg-white text-base font-bold leading-none text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-30"
                    aria-label={`Fewer goals for ${m.opponent}`}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center font-extrabold text-gray-900 tabular-nums">
                    {m.opponentGoals}
                  </span>
                  <button
                    onClick={() =>
                      patch(m.id, {
                        action: "opponent-goals",
                        opponentGoals: m.opponentGoals + 1,
                      })
                    }
                    disabled={busyId === m.id}
                    className="h-7 w-7 cursor-pointer rounded-lg bg-green-600 text-base font-bold leading-none text-white hover:bg-green-700 disabled:opacity-40"
                    aria-label={`More goals for ${m.opponent}`}
                  >
                    +
                  </button>
                  {/* A clean sheet is the team's, so it is counted here against
                      the game rather than on anybody's card. */}
                  {isCleanSheet(m) && (
                    <span className="ml-auto text-xs font-semibold text-green-700">
                      🥅 Clean sheet
                    </span>
                  )}
                </div>
                  </>
                )}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
