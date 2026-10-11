"use client";

import Link from "next/link";
import { backOr } from "@/lib/back";
import { useEffect, useState, useCallback } from "react";
import { useTeams } from "./ClubProvider";
import type { TeamSlug } from "@/lib/teams";
import { CAMERA_HOLDERS } from "@/lib/cameraHolders";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { TopBar } from "./SettingsUI";

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

export default function CameraRegister() {
  const { TEAMS, teamName, teamAccent } = useTeams();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import those fixtures");
    } finally {
      setImporting(false);
    }
  }

  if (!authed) {
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🎥</div>
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
            {loading ? "Loading…" : "Open register"}
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

  const shown = matches
    .filter((m) => m.home)
    .filter((m) => filter === "all" || m.team === filter)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const uploadedCount = shown.filter((m) => m.footageUploaded).length;

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      <TopBar title="Camera Register" href={`/admin${keyQuery(key)}`} />

      <div className="max-w-3xl mx-auto px-4 py-6">
        {legacy > 0 && (
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

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["all", ...TEAMS.map((t) => t.slug)] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 px-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                filter === f
                  ? "bg-green-600 border-green-600 text-white shadow"
                  : "bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-700 dark:bg-[#1c1c1e] dark:text-gray-200 dark:border-white/15"
              }`}
            >
              {f === "all" ? "All" : `${teamAccent(f)} ${teamName(f)}`}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
          {shown.length} home game{shown.length === 1 ? "" : "s"} · {uploadedCount} uploaded
        </p>

        {shown.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🎬</p>
            <p>No home games yet.</p>
            <Link
              href={`/admin/stats/matches${keyQuery(key)}`}
              className="mt-2 inline-block text-sm font-semibold text-green-700 hover:text-green-800 dark:text-green-400"
            >
              Add Fixtures in the Match Log →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl shadow-sm border p-4 ${
                  m.footageUploaded
                    ? "bg-green-50 border-green-200 dark:bg-green-400/10 dark:border-green-400/30"
                    : "bg-white border-gray-100 dark:bg-[#1c1c1e] dark:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <label
                    className="flex items-center cursor-pointer shrink-0"
                    title="Uploaded to Cloud"
                  >
                    <input
                      type="checkbox"
                      checked={m.footageUploaded}
                      disabled={busyId === m.id}
                      onChange={() =>
                        patch(m.id, {
                          action: "set-uploaded",
                          uploaded: !m.footageUploaded,
                        })
                      }
                      aria-label={`Footage uploaded for ${m.opponent}`}
                      className="h-6 w-6 accent-green-600 cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate dark:text-gray-50">
                      {teamAccent(m.team)} {teamName(m.team)}{" "}
                      <span className="text-gray-400 font-normal">vs</span> {m.opponent}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
                      {formatWhen(m.date, m.time)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      m.footageUploaded ? "text-green-700 dark:text-green-400" : "text-gray-400"
                    }`}
                  >
                    {m.footageUploaded ? "Uploaded ✓" : "Not uploaded"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 pl-9">
                  <span className="text-xs font-medium text-gray-500 shrink-0 dark:text-gray-400">
                    📸 Camera:
                  </span>
                  <select
                    value={m.cameraHolder}
                    onChange={(e) =>
                      patch(m.id, {
                        action: "set-camera-holder",
                        holder: e.target.value,
                      })
                    }
                    disabled={busyId === m.id}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
                    aria-label={`Who has the camera for ${m.opponent}`}
                  >
                    <option value="">— Not set —</option>
                    {CAMERA_HOLDERS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
