"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useTeams } from "./ClubProvider";
import type { TeamSlug } from "@/lib/teams";
import { CAMERA_HOLDERS } from "@/lib/cameraHolders";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { ToolTabs, TopBar, useScreens, GateScreen } from "./SettingsUI";
import { EmptyState, GateIcon, emptyAction } from "./Icons";
import TeamPicker from "./TeamPicker";

// Home games come from the match log now, so a fixture is only entered once.
// This page is the filming view of those same games.
interface Match {
  id: string;
  team: string;
  opponent: string;
  date: string;
  time: string;
  home: boolean;
  cameraHolder: string;
  footageUploaded: boolean;
  calledOff?: "" | "postponed" | "cancelled";
}


function formatWhen(date: string, time: string) {
  const d = new Date(`${date}T${time || "00:00"}`);
  if (isNaN(d.getTime())) return `${date} ${time}`.trim();
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(time ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  });
}

/** Part of a "YYYY-MM-DD" date — its short month, or its day — for the date badge. */
const dayPart = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

export default function CameraRegister() {
  const { screen, open, switchTo, close } = useScreens("/admin/camera");
  const view = screen === "pending" || screen === "uploaded" ? screen : "upcoming";
  const { TEAMS, teamName } = useTeams();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<"all" | TeamSlug>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  // fixtures still sitting in the old standalone register
  const [legacy, setLegacy] = useState(0);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const [matchRes, legacyRes] = await Promise.all([
        fetch(`/api/stats/matches?key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/camera?key=${encodeURIComponent(adminKey)}`),
      ]);
      if (matchRes.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!matchRes.ok) throw new Error("Failed to load");
      setMatches((await matchRes.json()).matches ?? []);
      if (legacyRes.ok) setLegacy(((await legacyRes.json()).legacy ?? []).length);
      setAuthed(true);
    } catch {
      setError("Could not load the register. Please try again.");
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

  async function patch(matchId: string, body: Record<string, unknown>) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setBusyId(null);
    }
  }

  async function importLegacy() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/camera?key=${encodeURIComponent(key)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not import those fixtures");
      setMatches((prev) => [...prev, ...(data.matches ?? [])]);
      setLegacy(0);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import those fixtures");
    } finally {
      setImporting(false);
    }
  }

  if (!authed) {
    if (checking) return <ToolSkeleton />;
    return (
      <GateScreen title="Camera Register">
        <div className="bg-white rounded-3xl shadow-sm p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <GateIcon />
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Camera Register</h1>
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
            {loading ? "Loading…" : "Open Camera Register"}
          </button>
        </div>
      </GateScreen>
    );
  }

  const filtered = matches
    // a game called off has nothing to film
    .filter((m) => m.home && !m.calledOff)
    .filter((m) => filter === "all" || m.team === filter)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const upcoming = filtered.filter((match) => match.date >= today).reverse();
  const pending = filtered.filter((match) => match.date < today && !match.footageUploaded);
  const uploaded = filtered.filter((match) => match.footageUploaded);
  const shown = view === "uploaded" ? uploaded : view === "pending" ? pending : upcoming;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      {screen === "import" ? <TopBar title="Import Camera Fixtures" onBack={close} /> : <TopBar title="Camera Register" href={`/admin${keyQuery(key)}`} />}

      <div className="mx-auto max-w-2xl px-4 py-4">
        {legacy > 0 && screen === "import" && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-400/10 dark:border-amber-400/40">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {legacy} fixture{legacy === 1 ? "" : "s"} from the old register
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Home games now live in the match log, so each one is only entered once.
              Bring these across and they&apos;ll appear here and in the match log.
            </p>
            <button
              onClick={importLegacy}
              disabled={importing}
              className="mt-3 cursor-pointer rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {importing
                ? "Importing…"
                : `Import ${legacy} fixture${legacy === 1 ? "" : "s"}`}
            </button>
          </div>
        )}

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div hidden={screen === "import"}>
        <TeamPicker className="mb-4 block" value={filter} onChange={(value) => setFilter(value)} options={[{ value: "all", label: "All teams" }, ...TEAMS.map((option) => ({ value: option.slug, label: option.name }))]} />
        <ToolTabs label="Camera views" tabs={[{ id: "upcoming", label: "Upcoming", count: upcoming.length }, { id: "pending", label: "To Upload", count: pending.length }, { id: "uploaded", label: "Uploaded", count: uploaded.length }]} value={view} onChange={switchTo} panelId="camera-panel" />
        <div id="camera-panel" role="tabpanel" aria-label={view}>

        <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
          {shown.length} home game{shown.length === 1 ? "" : "s"}
        </p>

        {shown.length === 0 ? (
          <EmptyState
            icon="camera"
            title={view === "pending" ? "No uploads waiting" : view === "uploaded" ? "No uploaded footage yet" : "No upcoming home games"}
            body={view === "upcoming" ? "Home games from the Match Log show here, to pick who's filming." : undefined}
            action={view === "upcoming" ? <Link href={`/admin/stats/matches${keyQuery(key)}`} className={emptyAction}>Open the Match Log</Link> : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((m) => (
              <div key={m.id} className="rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
                {/* the game: its date, who it's against, which team and when */}
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 rounded-xl bg-green-50 py-1.5 text-center dark:bg-green-400/10">
                    <span className="block text-[11px] font-bold uppercase text-green-700 dark:text-green-400">{dayPart(m.date, { month: "short" })}</span>
                    <span className="block text-xl font-extrabold leading-tight text-gray-900 dark:text-gray-50">{dayPart(m.date, { day: "numeric" })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block break-words font-bold leading-snug text-gray-900 dark:text-gray-50">vs {m.opponent}</span>
                    <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{teamName(m.team)} · <span className="whitespace-nowrap">{formatWhen(m.date, m.time)}</span></span>
                  </span>
                </div>
                {/* who's filming, and whether the footage reached the cloud */}
                <div className="mt-3 divide-y divide-gray-200/70 overflow-hidden rounded-2xl bg-gray-50 dark:divide-white/10 dark:bg-white/5">
                  <label className="flex min-h-12 items-center gap-3 px-3">
                    <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">Camera</span>
                    <select
                      value={m.cameraHolder}
                      onChange={(e) => patch(m.id, { action: "set-camera-holder", holder: e.target.value })}
                      disabled={busyId === m.id}
                      className="min-w-0 flex-1 bg-transparent py-2 text-right text-sm text-gray-900 focus:outline-none dark:text-gray-50"
                      aria-label={`Who has the camera for ${m.opponent}`}
                    >
                      <option value="">Not set</option>
                      {CAMERA_HOLDERS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200">Footage uploaded</span>
                    <input
                      type="checkbox"
                      checked={m.footageUploaded}
                      disabled={busyId === m.id}
                      onChange={() => patch(m.id, { action: "set-uploaded", uploaded: !m.footageUploaded })}
                      aria-label={`Footage uploaded for ${m.opponent}`}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="relative h-7 w-12 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-green-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-green-400 peer-disabled:opacity-60 dark:bg-white/20"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        {legacy > 0 && <button onClick={() => open("import")} className="mt-5 min-h-11 text-sm font-semibold text-amber-800 dark:text-amber-300">Import old fixtures ({legacy})</button>}
        </div>
      </div>
    </main>
  );
}
