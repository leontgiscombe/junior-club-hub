"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useTeams } from "./ClubProvider";
import { useMyTeam } from "@/lib/myTeam";
import FaSync from "./FaSync";
import { countsTowardsRecord, outcome, seasonRecord } from "@/lib/record";
import { cleanSheetCount, isCleanSheet, playedCount } from "@/lib/cleanSheets";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { ToolTabs, TopBar, useScreens, GateScreen } from "./SettingsUI";
import { StepBar, StepButtons } from "./Steps";
import { haptic } from "@/lib/haptics";
import { ask } from "@/lib/dialog";
import { EmptyState, GateIcon } from "./Icons";
import TeamPicker from "./TeamPicker";

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
  // postponed or cancelled: the game didn't go ahead ("" when it's on)
  calledOff: "" | "postponed" | "cancelled";
  createdAt: string;
}

const CALLED_OFF_LABEL = { postponed: "Postponed", cancelled: "Cancelled" } as const;

/** Whether anything is logged against a game yet; only a game with nothing logged can be called off. */
const anythingLogged = (m: Match) =>
  m.resultLogged || m.goals.length > 0 || m.opponentGoals > 0 || m.appearanceIds.length > 0 || !!m.potmId || !!m.mostImprovedId;

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
const LOG_STEPS = [
  { id: "score", label: "Score" },
  { id: "awards", label: "Awards" },
  { id: "played", label: "Who Played" },
  { id: "check", label: "Check" },
];

function gameType(g: { friendly: boolean; cup: boolean }): GameType {
  return !g.friendly ? "league" : g.cup ? "cup" : "friendly";
}

function fromGameType(type: string) {
  return { friendly: type !== "league", cup: type === "cup" };
}

function GameTypeOptions() {
  return (
    <>
      <option value="league">League Game</option>
      <option value="cup">Cup Game</option>
      <option value="friendly">Friendly</option>
    </>
  );
}

// Per-game awards, each feeding the matching season tally.
const AWARDS: {
  field: "potmId" | "mostImprovedId";
  action: string;
  label: string;
}[] = [
  { field: "potmId", action: "set-potm", label: "Player of the Match" },
  { field: "mostImprovedId", action: "set-most-improved", label: "Most Improved" },
];


/**
 * A game's badge, as on Home: a result's score in green, amber or red (won,
 * drew, lost), grey while no score is logged; a game to come, its date.
 */
function GameBadge({ match, played }: { match: Match; played: boolean }) {
  if (!played) {
    const d = new Date(`${match.date}T00:00`);
    // a game called off greys out
    return (
      <span className={`w-12 shrink-0 rounded-xl py-1.5 text-center ${match.calledOff ? "bg-gray-100 opacity-60 dark:bg-white/10" : "bg-green-50 dark:bg-green-400/10"}`}>
        <span className={`block text-[11px] font-bold uppercase ${match.calledOff ? "text-gray-500 dark:text-gray-400" : "text-green-700 dark:text-green-400"}`}>
          {isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { month: "short" })}
        </span>
        <span className="block text-xl font-extrabold leading-tight text-gray-900 dark:text-gray-50">{isNaN(d.getTime()) ? "?" : d.getDate()}</span>
      </span>
    );
  }
  const colour = !match.resultLogged
    ? "bg-gray-300 dark:bg-white/20"
    : { W: "bg-green-600", D: "bg-amber-500", L: "bg-red-600" }[outcome(match)];
  return (
    <span className={`grid h-12 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-lg font-extrabold text-white ${colour}`}>
      {match.resultLogged ? `${match.goals.length}–${match.opponentGoals}` : "–"}
    </span>
  );
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function MatchLog() {
  const { screen, open, switchTo, close } = useScreens("/admin/stats/matches");
  const selectedId = screen.startsWith("match-") ? screen.slice(6) : "";
  const view = screen === "results" || screen === "record" ? screen : "fixtures";
  const { TEAMS, teamName, findTeam } = useTeams();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
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
  // each game folds to one line; a game still to score, and the next one, open by themselves
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
  // which step of logging the open game is on; a game opens on the first
  const [logStepFor, setLogStepFor] = useState({ id: "", step: 0 });
  // the game whose Edit / Remove menu is open
  const [menuFor, setMenuFor] = useState<string | null>(null);

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
      haptic();
      setMatches((prev) => [...prev, data.match]);
      setOpponent("");
      setDate("");
      open(`match-${data.match.id}`);
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
      haptic();
      if (data.players) setPlayers(data.players);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  // A game that isn't going ahead: postponed (a new date to come) or cancelled.
  async function callOff(match: Match, calledOff: "postponed" | "cancelled") {
    const what = calledOff === "postponed" ? "postponed — it stays in the fixtures until you give it a new date" : "cancelled — it won't be played";
    if (!await ask(`Mark ${teamName(match.team)} v ${match.opponent} as ${what}?\n\nFamilies see it on Home.`)) return;
    await patch(match.id, { action: "call-off", calledOff });
  }

  function callOffRow(match: Match, label: string) {
    const button = "cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-40 dark:text-gray-200 dark:border-white/15";
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <button onClick={() => callOff(match, "postponed")} disabled={busyId === match.id} className={button}>
          Postponed
        </button>
        <button onClick={() => callOff(match, "cancelled")} disabled={busyId === match.id} className={button}>
          Cancelled
        </button>
      </div>
    );
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
      !await ask(
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
    if (checking) return <ToolSkeleton />;
    return (
      <GateScreen title="Match Log">
        <div className="bg-white rounded-3xl shadow-sm p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <GateIcon />
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Match Log</h1>
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
            {loading ? "Loading…" : "Open match log"}
          </button>
        </div>
      </GateScreen>
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
  // A game called off was never played.
  const isPlayed = (m: Match) =>
    !m.calledOff && (m.goals.length > 0 || m.opponentGoals > 0 || m.date < todayStr);
  // A postponed game stays with the fixtures until it has its new date; a
  // cancelled one moves to the results once its day has gone.
  const isDone = (m: Match) => isPlayed(m) || (m.calledOff === "cancelled" && m.date < todayStr);

  // Next game first for what's coming; most recent first for what's done.
  const upcoming = shown
    .filter((m) => !isDone(m))
    .sort((a, b) => a.date.localeCompare(b.date));
  const results = shown
    .filter(isDone)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Friendlies and cup games are logged, but kept out of the league record.
  const logged = results.filter(countsTowardsRecord);
  const record = seasonRecord(logged);
  const awaiting = results.filter(isPlayed).length - logged.length;
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

  // a game folded to its one line unless tapped open; one still to score, and the next game, start open
  const gameOpen = (match: Match) => match.id === selectedId;
  const logStep = logStepFor.id === selectedId ? logStepFor.step : 0;
  // a game being logged, step by step (rather than a fixture not started, or one called off)
  const inSteps = (m: Match) => !m.calledOff && (isPlayed(m) || expanded.includes(m.id));
  // "Alfie Smith ×2, Scorer not recorded ×3"
  const goalLine = (m: Match) => {
    const counts = new Map<string, number>();
    for (const g of m.goals) {
      const who = g.scorerId ? playerName(g.scorerId) : "Scorer not recorded";
      counts.set(who, (counts.get(who) ?? 0) + 1);
    }
    return [...counts].map(([who, n]) => (n > 1 ? `${who} ×${n}` : who)).join(", ");
  };
  const setLogStep = (step: number) => {
    setLogStepFor({ id: selectedId, step });
    window.scrollTo(0, 0);
  };
  const visibleGames = selectedId ? shown.filter((match) => match.id === selectedId) : view === "results" ? results : upcoming;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      {selectedId || screen === "add" ? <TopBar title={screen === "add" ? "Add Game" : shown.find((match) => match.id === selectedId)?.opponent || "Match Details"} onBack={() => { setEditingId(null); close(); }} /> : <TopBar title="Match Log" href={`/admin${keyQuery(key)}`} />}

      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* Team tabs */}
        {!selectedId && screen !== "add" && <><TeamPicker className="mb-4 block" value={team} onChange={(value) => { setTeam(value); setOpponent(""); setEditingId(null); }} options={TEAMS.map((option) => ({ value: option.slug, label: option.name }))} /><ToolTabs label="Match views" tabs={[{ id: "fixtures", label: "Fixtures", count: upcoming.length }, { id: "results", label: "Results", count: results.length }, { id: "record", label: "Record" }]} value={view} onChange={switchTo} panelId="matches-panel" /></>}
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">{error}</p>}
        <div id="matches-panel" role={selectedId || screen === "add" ? undefined : "tabpanel"} aria-label={view}>

        {/* Our record so far — shown as soon as the team has any games, so the
            table is findable before the first result is in */}
        {view === "record" && shown.length > 0 && (
          <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
            <div className="mb-3 flex items-center justify-between gap-3">
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
                  <tr className="font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
                    <td className="px-1 py-1">{record.played}</td>
                    <td className="px-1 py-1 text-green-700 dark:text-green-400">{record.won}</td>
                    <td className="px-1 py-1">{record.drawn}</td>
                    <td className="px-1 py-1 text-red-600 dark:text-red-400">{record.lost}</td>
                    <td className="px-1 py-1">{record.scored}</td>
                    <td className="px-1 py-1">{record.conceded}</td>
                    <td className="px-1 py-1">
                      {record.difference > 0 ? `+${record.difference}` : record.difference}
                    </td>
                    <td className="px-1 py-1 text-green-700 dark:text-green-400">{record.points}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* A clean sheet belongs to the team, so it is counted in games
                here rather than against each player's name. Cup and friendly
                games count towards it as much as league ones. */}
            {playedGames > 0 && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
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
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {awaiting} past game{awaiting === 1 ? "" : "s"} not counted yet — add
                the score, or confirm a 0–0, below.
              </p>
            )}
          </div>
        )}

        <div hidden={view !== "fixtures" || !!selectedId}>
        {/* Fixtures kept in step with FA Full-Time, for teams with a snippet */}
        <FaSync<Match> team={team} adminKey={key} onMatches={setMatches} />

        {/* Add match: folded behind a button once the team has games */}
        {screen !== "add" ? (
          <button
            onClick={() => open("add")}
            className="mb-4 w-full cursor-pointer rounded-2xl bg-white px-4 py-3 text-left text-sm font-bold text-green-700 shadow-sm dark:bg-[#1c1c1e] dark:text-green-400"
          >
            + Add a Game
          </button>
        ) : (
        <form
          onSubmit={addMatch}
          className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[17px] font-bold text-gray-900 dark:text-gray-50">Add a Game for {teamName(team)}</p>
            {shown.length > 0 && (
              <button type="button" onClick={close} className="shrink-0 cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400">
                Cancel
              </button>
            )}
          </div>
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
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
            >
              <GameTypeOptions />
            </select>

            {!friendly && leagueOpponents.length > 0 ? (
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                aria-label="Opponent"
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
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
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
              />
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Kick-off time"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
            />
            <select
              value={home ? "home" : "away"}
              onChange={(e) => setHome(e.target.value === "home")}
              aria-label="Home or away"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
            >
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
            <button
              type="submit"
              disabled={!opponent.trim() || !date || adding}
              className="rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {adding ? "Adding…" : "Add Game"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3 dark:text-red-400">{error}</p>}
        </form>
        )}
        </div>

        <div hidden={view === "record" || screen === "add"}>
        {squad.length === 0 && (
          <p className="mb-3 px-1 text-xs">
            <Link href={`/admin/members${keyQuery(key)}`} className="font-semibold text-amber-800 underline dark:text-amber-300">
              No players in {teamName(team)} yet: add them in Members
            </Link>{" "}
            <span className="text-gray-500 dark:text-gray-400">— scorers and awards are picked from the squad.</span>
          </p>
        )}

        {visibleGames.length === 0 ? (
          selectedId ? (
            <EmptyState icon="calendar" title="This match is no longer available" />
          ) : view === "results" ? (
            <EmptyState icon="trophy" title="No results yet" body="Scores show here once a game's been played and logged." />
          ) : (
            <EmptyState
              icon="calendar"
              title="No upcoming fixtures"
              body="Add the next game above, or bring the fixtures in from FA Full-Time in Settings."
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {visibleGames.map((m) => (
              <Fragment key={m.id}>
                <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
                {editingId === m.id ? (
                  /* Fixtures move — this changes the details without touching
                     any goals, awards or appearances already logged. */
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Edit Fixture
                      </p>
                      <button
                        onClick={() => setEditingId(null)}
                        className="shrink-0 cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400"
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
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
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
                          className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
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
                          className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
                        />
                      )}

                      <input
                        type="date"
                        value={draft.date}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, date: e.target.value }))
                        }
                        aria-label="Date"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
                      />
                      <input
                        type="time"
                        value={draft.time}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, time: e.target.value }))
                        }
                        aria-label="Kick-off time"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
                      />
                      <select
                        value={draft.home ? "home" : "away"}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, home: e.target.value === "home" }))
                        }
                        aria-label="Home or away"
                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
                      >
                        <option value="home">Home</option>
                        <option value="away">Away</option>
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
                <div className="relative flex items-center gap-3">
                  <GameBadge match={m} played={isPlayed(m)} />
                  <button
                    type="button"
                    onClick={() => { if (!selectedId) open(`match-${m.id}`); }}
                    aria-expanded={gameOpen(m)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <p className="line-clamp-2 break-words font-bold leading-snug text-gray-900 dark:text-gray-50">vs {m.opponent || "TBC"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
                      <span className="whitespace-nowrap">
                        {m.home ? "Home" : "Away"} · {formatDate(m.date)}
                        {m.time && ` · ${m.time}`}
                      </span>
                      {gameType(m) !== "league" && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:bg-white/10 dark:text-gray-300">
                          {gameType(m) === "cup" ? "Cup" : "Friendly"}
                        </span>
                      )}
                      {m.calledOff && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${m.calledOff === "cancelled" ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300" : "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"}`}>
                          {CALLED_OFF_LABEL[m.calledOff]}
                        </span>
                      )}
                      {isPlayed(m) && !m.resultLogged && <span className="text-amber-700 dark:text-amber-300">No score logged</span>}
                    </p>
                  </button>
                  {gameOpen(m) && inSteps(m) ? (
                    // while it's being logged, changing or removing the game is tucked in here
                    <>
                      <button
                        onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                        aria-label="More for this game"
                        aria-expanded={menuFor === m.id}
                        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                      </button>
                      {menuFor === m.id && (
                        <>
                          <button aria-label="Close" onClick={() => setMenuFor(null)} className="fixed inset-0 z-20 cursor-default" />
                          <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5 dark:bg-[#2c2c2e] dark:ring-white/10">
                            <button
                              onClick={() => { setMenuFor(null); startEdit(m); }}
                              className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:text-gray-50 dark:hover:bg-white/5"
                            >
                              Edit Game
                            </button>
                            <button
                              onClick={() => { setMenuFor(null); removeMatch(m); }}
                              className="flex w-full cursor-pointer items-center gap-2 border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-white/10 dark:text-red-400 dark:hover:bg-red-400/10"
                            >
                              Remove Game
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-gray-300 transition-transform dark:text-gray-600 ${gameOpen(m) ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                  )}
                </div>
                )}

                {gameOpen(m) && editingId !== m.id && (<>
                {/* A game called off: nothing to log, until it's back on */}
                {m.calledOff ? (
                  <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${m.calledOff === "cancelled" ? "bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200" : "bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"}`}>
                    <p className="font-bold">This game was {m.calledOff}.</p>
                    <p className="mt-0.5 text-xs">
                      {m.calledOff === "postponed"
                        ? "Once it has a new date, tap Edit Game and change the date: it's back on."
                        : "It's kept out of the results and the league record."}
                    </p>
                    <button
                      onClick={() => patch(m.id, { action: "call-off", calledOff: "" })}
                      disabled={busyId === m.id}
                      className="mt-2 cursor-pointer text-xs font-bold underline disabled:opacity-40"
                    >
                      It&apos;s back on — undo
                    </button>
                  </div>
                ) : !isPlayed(m) && !expanded.includes(m.id) ? (
                  // a fixture still to come: Log the Game is with the buttons below
                  null
                ) : (
                  <>
                {/* Logging the game a step at a time: each change saves as it's made */}
                <StepBar steps={LOG_STEPS} step={logStep} onChange={setLogStep} className="mt-4 mb-4" />
                {/* a past game with nothing logged may not have gone ahead */}
                {logStep === 0 && !anythingLogged(m) && callOffRow(m, "Didn't go ahead?")}

                {/* Step 1: the score and who scored */}
                <div hidden={logStep !== 0}>
                {/* Our score, for a result written up afterwards: the goals
                    nobody can put a name to still count towards it. */}
                <div className="mt-1 flex items-center gap-2">
                  <span className="w-36 shrink-0 break-words text-xs font-medium text-gray-500 dark:text-gray-400">
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
                    className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 bg-white text-base font-bold leading-none text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-30 dark:bg-[#1c1c1e] dark:text-gray-300 dark:border-white/15"
                    title={
                      m.goals.filter((g) => !g.scorerId).length === 0
                        ? "Every goal here has a scorer — remove one from the list above"
                        : `Fewer goals for ${teamName(m.team)}`
                    }
                    aria-label={`Fewer goals for ${teamName(m.team)}`}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
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
                  <span className="w-36 shrink-0 break-words text-xs font-medium text-gray-500 dark:text-gray-400">
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
                    className="h-7 w-7 cursor-pointer rounded-lg border border-gray-200 bg-white text-base font-bold leading-none text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-30 dark:bg-[#1c1c1e] dark:text-gray-300 dark:border-white/15"
                    aria-label={`Fewer goals for ${m.opponent}`}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
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
                    <span className="ml-auto text-xs font-semibold text-green-700 dark:text-green-400">
                      Clean sheet
                    </span>
                  )}
                </div>
                {/* Goals */}
                {m.goals.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {m.goals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-green-700 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
                          <path d="M12 3v4M21 10l-5 0M3 10h5M9.5 14.5 7 19M14.5 14.5 17 19" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {g.scorerId ? (
                            <>
                              <span className="font-bold text-gray-900 dark:text-gray-50">
                                {playerName(g.scorerId)}
                              </span>
                              {g.assistId ? (
                                <span className="text-gray-500 dark:text-gray-400">
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
                {/* Add a goal */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={scorerFor[m.id] ?? ""}
                    onChange={(e) =>
                      setScorerFor((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    aria-label={`Goal scorer for ${m.opponent}`}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
                  >
                    <option value="">Scorer…</option>
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
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
                  >
                    <option value="">No assist</option>
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
                    className="mt-3 w-full cursor-pointer rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20 dark:border-amber-400/40"
                  >
                    Confirm 0–0 (counts it in the record)
                  </button>
                )}
                </div>

                {/* Step 2: the game's awards */}
                <div hidden={logStep !== 1}>
                {/* Per-game awards */}
                <div className="mt-1 flex flex-col gap-3">
                  {AWARDS.map((a) => (
                    <div key={a.field} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {a.label}
                      </span>
                      <select
                        value={m[a.field] ?? ""}
                        onChange={(e) =>
                          patch(m.id, { action: a.action, playerId: e.target.value })
                        }
                        disabled={busyId === m.id}
                        aria-label={`${a.label} for ${m.opponent}`}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
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
                </div>

                {/* Step 3: who played */}
                <div hidden={logStep !== 2}>
                {/* Who played */}
                <div className="mt-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Who Played ({(m.appearanceIds ?? []).length})
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
                        className="cursor-pointer text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-40 dark:text-green-400"
                      >
                        All
                      </button>
                      <button
                        onClick={() =>
                          patch(m.id, { action: "set-appearances", playerIds: [] })
                        }
                        disabled={busyId === m.id || (m.appearanceIds ?? []).length === 0}
                        className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:text-gray-400"
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
                                : "border-gray-200 bg-white text-gray-600 hover:border-green-400 hover:text-green-700 dark:bg-[#1c1c1e] dark:text-gray-300 dark:border-white/15"
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>
                </div>

                {/* Step 4: check it all */}
                {logStep === 3 && (
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-center dark:bg-white/5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Final score</p>
                      <p className="text-2xl font-extrabold text-gray-900 tabular-nums dark:text-gray-50">
                        {m.goals.length} – {m.opponentGoals}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {teamName(m.team)} v {m.opponent}
                        {isCleanSheet(m) && " · Clean sheet"}
                      </p>
                      {isPlayed(m) && !m.resultLogged && (
                        <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          No score logged yet — go back to Score to add one or confirm a 0–0.
                        </p>
                      )}
                    </div>
                    {[
                      {
                        label: "Goals",
                        value: m.goals.length
                          ? goalLine(m)
                          : "None",
                        step: 0,
                      },
                      ...AWARDS.map((a) => ({
                        label: a.label,
                        value: m[a.field] ? playerName(m[a.field]) : "Not awarded",
                        step: 1,
                      })),
                      {
                        label: "Who Played",
                        value: (m.appearanceIds ?? []).length
                          ? `${(m.appearanceIds ?? []).length} player${(m.appearanceIds ?? []).length === 1 ? "" : "s"}`
                          : "Nobody ticked",
                        step: 2,
                      },
                    ].map((row) => (
                      <button
                        key={row.label}
                        type="button"
                        onClick={() => setLogStep(row.step)}
                        className="flex cursor-pointer items-baseline gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <span className="w-28 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{row.label}</span>
                        <span className="min-w-0 flex-1 font-semibold text-gray-900 dark:text-gray-50">{row.value}</span>
                        <span className="shrink-0 text-xs font-semibold text-green-700 dark:text-green-400">Change</span>
                      </button>
                    ))}
                  </div>
                )}

                <StepButtons
                  step={logStep}
                  count={LOG_STEPS.length}
                  nextLabel={`Next: ${LOG_STEPS[logStep + 1]?.label}`}
                  onChange={setLogStep}
                  finish={{ label: "Done", onClick: () => { setEditingId(null); close(); } }}
                />
                  </>
                )}
                {/* change or remove the game: inside it, not crowding the card */}
                {!m.calledOff && !isPlayed(m) && !expanded.includes(m.id) && !anythingLogged(m) && callOffRow(m, "Called off?")}
                {!inSteps(m) && (
                <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/10">
                  {!m.calledOff && !isPlayed(m) && !expanded.includes(m.id) && (
                    <button
                      onClick={() => { setExpanded((prev) => [...prev, m.id]); setLogStep(0); }}
                      className="mb-2 min-h-10 w-full cursor-pointer rounded-xl bg-green-600 text-sm font-bold text-white hover:bg-green-700"
                    >
                      Log the Game
                    </button>
                  )}
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(m)}
                    disabled={busyId === m.id}
                    className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 text-sm font-semibold text-gray-800 disabled:opacity-40 dark:bg-white/10 dark:text-gray-100"
                    aria-label={`Edit ${teamName(m.team)} v ${m.opponent}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                      <path d="m14 6 4 4" />
                    </svg>
                    Edit Game
                  </button>
                  <button
                    onClick={() => removeMatch(m)}
                    disabled={busyId === m.id}
                    className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-semibold text-red-600 disabled:opacity-40 dark:bg-red-400/10 dark:text-red-400"
                    aria-label={`Remove ${teamName(m.team)} v ${m.opponent}`}
                  >
                    Remove Game
                  </button>
                </div>
                </div>
                )}
                </>)}
                </div>
              </Fragment>
            ))}
          </div>
        )}
        </div>

        {/* Who sets up whom */}
        {view === "record" && topPairs.length > 0 && (
          <div className="mt-6 mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
            <p className="mb-3 text-[17px] font-bold text-gray-900 dark:text-gray-50">Assist Combinations</p>
            <div className="flex flex-col gap-2">
              {topPairs.map((p) => (
                <div
                  key={`${p.assistId}|${p.scorerId}`}
                  className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5"
                >
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-900 dark:text-gray-50">
                    {playerName(p.assistId)}{" "}
                    <span className="font-normal text-gray-400">→</span>{" "}
                    {playerName(p.scorerId)}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold text-green-700 tabular-nums dark:text-green-400">
                    ×{p.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {view === "record" && !shown.length && <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No matches recorded yet.</p>}
        </div>
      </div>
    </main>
  );
}
