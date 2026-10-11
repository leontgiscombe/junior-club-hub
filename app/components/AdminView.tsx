"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useTeams } from "./ClubProvider";
import type { TeamSlug } from "@/lib/teams";
import { getMyTeam, setMyTeam } from "@/lib/myTeam";
import { useClub } from "./ClubProvider";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { TopBar } from "./SettingsUI";
import { KIT_EXTRAS, type KitExtra } from "@/lib/clubSettings";
import { KIT_ITEMS, type KitItem } from "@/lib/kitItems";

interface Submission {
  id: string;
  childName: string;
  shirtSize: string;
  shortsSize: string;
  socksSize: string;
  extras?: Partial<Record<KitExtra, string>>;
  submittedAt: string;
}

/** Kit a parent has asked for during the season (lib/kitRequests.ts). */
interface KitRequest {
  id: string;
  childName: string;
  item: KitItem;
  size: string;
  quantity: number;
  note?: string;
  requestedBy: string;
  createdAt: string;
  doneAt?: string;
}

/** The extra kit items to show: the ones the club collects, and any already in the answers. */
function extrasIn(rows: Submission[], club: KitExtra[]): KitExtra[] {
  return (Object.keys(KIT_EXTRAS) as KitExtra[]).filter((e) => club.includes(e) || rows.some((r) => r.extras?.[e]));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toCSV(rows: Submission[], extras: KitExtra[]): string {
  const header = ["Name", "Shirt", "Shorts", "Socks", ...extras.map((e) => KIT_EXTRAS[e].label), "Submitted"].join(",");
  const lines = rows.map((r) =>
    [
      `"${r.childName}"`,
      r.shirtSize,
      r.shortsSize,
      r.socksSize,
      ...extras.map((e) => r.extras?.[e] ?? ""),
      `"${formatDate(r.submittedAt)}"`,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadCSV(rows: Submission[], team: string, extras: KitExtra[]) {
  const blob = new Blob([toCSV(rows, extras)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kit-sizes-${team}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// When `lockedTeam` is set the view is fixed to that one team (no tab switcher)
// — used by the per-team admin pages at /kit/<team>/admin. With no prop it shows
// all teams with a selector, used by the combined /kit/admin page.
export default function AdminView({ lockedTeam }: { lockedTeam?: TeamSlug }) {
  const { TEAMS, teamName, isValidTeam } = useTeams();
  const CLUB = useClub();
  const [key, setKey] = useState("");
  const [team, setTeam] = useState<TeamSlug>(lockedTeam ?? TEAMS[0].slug);
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  // squad members (from the stats tracker) who haven't sent sizes yet
  const [waiting, setWaiting] = useState<string[]>([]);
  const [requests, setRequests] = useState<KitRequest[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (adminKey: string, teamSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/responses?key=${encodeURIComponent(adminKey)}&team=${teamSlug}`
      );
      if (res.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load responses");
      const data = await res.json();
      setSubmissions(data.submissions);
      setWaiting(data.waiting ?? []);
      setRequests(data.requests ?? []);
      setAuthed(true);
    } catch {
      setError("Could not load responses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  function switchTeam(teamSlug: TeamSlug) {
    setTeam(teamSlug);
    setMyTeam(teamSlug);
    load(key, teamSlug);
  }

  async function changeRequest(id: string, change: { done: boolean } | { remove: true }) {
    if ("remove" in change && !confirm("Remove this request?")) return;
    const res = await fetch(`/api/responses${keyQuery(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id, ...change }),
    });
    if (!res.ok) return alert("That didn't save — please try again.");
    const data = await res.json();
    setRequests((all) => ("remove" in change ? all.filter((r) => r.id !== id) : all.map((r) => (r.id === id ? data.request : r))));
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this submission?")) return;
    setDeleting(id);
    try {
      await fetch(
        `/api/responses${keyQuery(key, `team=${team}`)}&id=${id}`,
        { method: "DELETE" }
      );
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      // a removed answer can put its child back on the still-to-send list
      load(key, team);
    } finally {
      setDeleting(null);
    }
  }

  // Seed key/team from the URL once on mount. Done in an effect (not a lazy
  // state initializer) so the statically-rendered page hydrates without a
  // server/client value mismatch; the setState calls here run only on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("key");
    const urlTeam = params.get("team");
    const startTeam =
      lockedTeam ??
      (urlTeam && isValidTeam(urlTeam) ? urlTeam : getMyTeam(isValidTeam) ?? TEAMS[0].slug);
    setTeam(startTeam);
    if (urlKey) {
      setKey(urlKey);
      Promise.resolve(load(urlKey, startTeam)).finally(() => setChecking(false));
    } else {
      // signed in with an account, or the coach password given earlier: no password box
      accountKey()
        .then(async (k) => {
          if (k) {
            setKey(k);
            await load(k, startTeam);
          }
        })
        .finally(() => setChecking(false));
    }
  }, [load, lockedTeam, TEAMS, isValidTeam]);
  // a coach password that worked here opens every other tool too
  useEffect(() => {
    if (authed) rememberCoachKey(key);
  }, [authed, key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!authed) {
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🔒</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Admin Access</h1>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
              {CLUB.name} – {lockedTeam ? `${teamName(team)} kit` : "Kit"} responses
            </p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key, team)}
            placeholder="Enter admin password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3 dark:text-gray-50 dark:border-white/15"
          />
          {error && (
            <p className="text-sm text-red-600 mb-3 text-center dark:text-red-400">{error}</p>
          )}
          <button
            onClick={() => load(key, team)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Loading…" : "View responses"}
          </button>
          <Link
            href="/"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400"
          >
            ← Back to Team Hub
          </Link>
        </div>
      </main>
    );
  }

  const sorted = [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <main className="themed min-h-screen bg-gray-100 dark:bg-black dark:text-gray-50">
      <TopBar title={<>{teamName(team)} – Kit Responses</>} href={`/admin${keyQuery(key)}`} />

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Team selector (combined admin only) */}
        {!lockedTeam && (
          <div className="flex gap-2 mb-5">
            {TEAMS.map((t) => (
              <button
                key={t.slug}
                onClick={() => switchTeam(t.slug)}
                className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                  team === t.slug
                    ? "bg-green-600 border-green-600 text-white shadow"
                    : "bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-700 dark:bg-[#1c1c1e] dark:text-gray-200 dark:border-white/15"
                }`}
              >
                {t.accent} {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center dark:bg-[#1c1c1e]">
            <p className="text-2xl font-extrabold text-green-700 dark:text-green-400">{submissions.length}</p>
            <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
              {teamName(team)} responses
            </p>
          </div>
        </div>

        {/* Kit asked for during the season */}
        {requests.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-50">
              📦 Kit Requests{requests.some((r) => !r.doneAt) ? ` (${requests.filter((r) => !r.doneAt).length} to sort)` : ""}
            </p>
            <div className="flex flex-col gap-2">
              {requests
                .filter((r) => !r.doneAt || showDone)
                .map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-2xl border p-4 shadow-sm ${
                      r.doneAt
                        ? "border-gray-100 bg-gray-50 opacity-70 dark:border-white/10 dark:bg-white/5"
                        : "border-blue-200 bg-white dark:border-blue-400/30 dark:bg-[#1c1c1e]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-gray-50">
                          {KIT_ITEMS[r.item]?.emoji} {r.quantity > 1 ? `${r.quantity} × ` : ""}
                          {KIT_ITEMS[r.item]?.label ?? r.item} · {r.size}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">For {r.childName}</p>
                        {r.note && <p className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">“{r.note}”</p>}
                        <p className="mt-1 text-xs text-gray-400">
                          Asked by {r.requestedBy} · {formatDate(r.createdAt)}
                          {r.doneAt ? ` · Done ${formatDate(r.doneAt)}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => changeRequest(r.id, { remove: true })}
                        className="text-lg leading-none text-gray-300 hover:text-red-400 cursor-pointer"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      onClick={() => changeRequest(r.id, { done: !r.doneAt })}
                      className={`mt-3 w-full cursor-pointer rounded-xl py-2 text-sm font-bold ${
                        r.doneAt
                          ? "border border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {r.doneAt ? "Not Done Yet" : "✓ Mark Done"}
                    </button>
                  </div>
                ))}
            </div>
            {requests.some((r) => r.doneAt) && (
              <button
                onClick={() => setShowDone((v) => !v)}
                className="mt-2 cursor-pointer text-sm font-semibold text-green-700 dark:text-green-400"
              >
                {showDone ? "Hide done requests" : `Show done requests (${requests.filter((r) => r.doneAt).length})`}
              </button>
            )}
          </div>
        )}

        {/* Who still needs to send sizes */}
        {waiting.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:bg-amber-400/10 dark:border-amber-400/30">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              ⏳ Still to Send ({waiting.length})
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              In the {teamName(team)} squad but no kit sizes yet.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {waiting.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 dark:bg-[#1c1c1e] dark:text-amber-200 dark:ring-amber-400/30"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mb-5">
          <button
            onClick={() => load(key, team)}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer dark:hover:bg-white/5 dark:bg-[#1c1c1e] dark:text-gray-200 dark:border-white/15"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => downloadCSV(sorted, team, extrasIn(sorted, CLUB.kitExtras))}
            disabled={submissions.length === 0}
            className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 shadow-sm disabled:opacity-40 cursor-pointer"
          >
            ⬇ Export CSV
          </button>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p>No responses yet for {teamName(team)}.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-50">{s.childName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.submittedAt)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none cursor-pointer"
                    title="Remove"
                  >
                    {deleting === s.id ? "…" : "✕"}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[
                    { icon: "👕", label: "Shirt", value: s.shirtSize },
                    { icon: "🩳", label: "Shorts", value: s.shortsSize },
                    { icon: "🧦", label: "Socks", value: s.socksSize },
                    ...extrasIn(sorted, CLUB.kitExtras).map((e) => ({
                      icon: KIT_EXTRAS[e].emoji,
                      label: KIT_EXTRAS[e].short,
                      value: s.extras?.[e] ?? "—",
                    })),
                  ].map(({ icon, label, value }) => (
                    <div
                      key={label}
                      className="bg-green-50 rounded-xl py-2 text-center dark:bg-green-400/10"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">{icon} {label}</p>
                      <p className={`font-extrabold text-green-700 mt-0.5 dark:text-green-400 ${value.length > 4 ? "text-sm" : "text-base"}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
