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
import { KIT_EXTRAS, NOT_NEEDED, type KitExtra } from "@/lib/clubSettings";
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

/** One CSV cell: quoted, with any quotes doubled, so commas and quotes in names are safe. */
const cell = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (rows: (string | number | undefined)[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");

function toCSV(rows: Submission[], extras: KitExtra[]): string {
  return csv([
    ["Name", "Shirt", "Shorts", "Socks", ...extras.map((e) => KIT_EXTRAS[e].label), "Submitted"],
    ...rows.map((r) => [r.childName, r.shirtSize, r.shortsSize, r.socksSize, ...extras.map((e) => r.extras?.[e] ?? ""), formatDate(r.submittedAt)]),
  ]);
}

/** A file to save: a CSV, opened by Excel or Numbers. */
function download(text: string, filename: string) {
  // the byte-order mark tells Excel it's UTF-8 (names with accents, the × sign)
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(rows: Submission[], team: string, extras: KitExtra[]) {
  download(toCSV(rows, extras), `kit-sizes-${team}.csv`);
}

/** Sizes in their own order (4XS … S, XS … M), not alphabetical; anything else last. */
const SIZE_ORDER = ["4XS", "3XS", "XXS", "XS", "S", "M", "L", "XL"];
const bySize = (a: string, b: string) =>
  (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);

/** How many of each item in each size the kit forms asked for — what to order. */
function downloadSizeTotals(rows: Submission[], team: string, extras: KitExtra[]) {
  const items: [string, (r: Submission) => string | undefined][] = [
    ["Shirt", (r) => r.shirtSize],
    ["Shorts", (r) => r.shortsSize],
    ["Socks", (r) => r.socksSize],
    ...extras.map((e) => [KIT_EXTRAS[e].label, (r: Submission) => r.extras?.[e]] as [string, (r: Submission) => string | undefined]),
  ];
  const out: (string | number)[][] = [["Item", "Size", "Quantity"]];
  for (const [label, sizeOf] of items) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const size = sizeOf(r);
      if (size && size !== NOT_NEEDED) counts.set(size, (counts.get(size) ?? 0) + 1);
    }
    for (const size of [...counts.keys()].sort(bySize)) out.push([label, size, counts.get(size)!]);
  }
  download(csv(out), `kit-size-totals-${team}.csv`);
}

/** Every kit request, one row per item. */
function downloadRequests(rows: KitRequest[], team: string) {
  download(
    csv([
      ["Player", "Item", "Size", "Quantity", "Note", "Asked By", "Asked On", "Status"],
      ...rows.map((r) => [
        r.childName,
        KIT_ITEMS[r.item]?.label ?? r.item,
        r.size,
        r.quantity,
        r.note,
        r.requestedBy,
        formatDate(r.createdAt),
        r.doneAt ? `Done ${formatDate(r.doneAt)}` : "Waiting",
      ]),
    ]),
    `kit-requests-${team}.csv`,
  );
}

/** What's still to order from kit requests: each item and size, how many, and for whom. */
function downloadOrderTotals(rows: KitRequest[], team: string) {
  const lines = new Map<string, { item: KitItem; size: string; quantity: number; players: string[] }>();
  for (const r of rows.filter((x) => !x.doneAt)) {
    const k = `${r.item}|${r.size}`;
    const line = lines.get(k) ?? { item: r.item, size: r.size, quantity: 0, players: [] };
    line.quantity += r.quantity;
    line.players.push(r.quantity > 1 ? `${r.childName} (${r.quantity})` : r.childName);
    lines.set(k, line);
  }
  const itemOrder = Object.keys(KIT_ITEMS) as KitItem[];
  download(
    csv([
      ["Item", "Size", "Quantity", "For"],
      ...[...lines.values()]
        .sort((a, b) => itemOrder.indexOf(a.item) - itemOrder.indexOf(b.item) || bySize(a.size, b.size))
        .map((l) => [KIT_ITEMS[l.item]?.label ?? l.item, l.size, l.quantity, l.players.join(", ")]),
    ]),
    `kit-order-totals-${team}.csv`,
  );
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
  // the players whose requests are opened up
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
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
    const res = await fetch(`/api/responses?key=${encodeURIComponent(key)}`, {
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
      // the key goes in as it is, even an account's (keyQuery leaves that out of links, not API calls)
      const res = await fetch(
        `/api/responses?key=${encodeURIComponent(key)}&team=${team}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        alert("That didn't delete — please try again.");
        return;
      }
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

  // kit requests by player: those with something still to sort first, newest first
  const requestGroups = Object.values(
    requests
      .filter((r) => !r.doneAt || showDone)
      .reduce<Record<string, { name: string; items: KitRequest[]; latest: string }>>((all, r) => {
        const g = (all[r.childName] ??= { name: r.childName, items: [], latest: r.createdAt });
        g.items.push(r);
        if (r.createdAt > g.latest) g.latest = r.createdAt;
        return all;
      }, {}),
  ).sort((a, b) => Number(b.items.some((r) => !r.doneAt)) - Number(a.items.some((r) => !r.doneAt)) || b.latest.localeCompare(a.latest));

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
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
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
            {/* grouped by player: tap a player to see what they've asked for */}
            <div className="flex flex-col gap-2">
              {requestGroups.map((g) => {
                const open = openGroups.has(g.name);
                const waiting = g.items.filter((r) => !r.doneAt);
                const count = (list: KitRequest[]) => list.reduce((n, r) => n + r.quantity, 0);
                return (
                  <div
                    key={g.name}
                    className={`overflow-hidden rounded-2xl border shadow-sm ${
                      waiting.length ? "border-blue-200 bg-white dark:border-blue-400/30 dark:bg-[#1c1c1e]" : "border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5"
                    }`}
                  >
                    <button
                      onClick={() =>
                        setOpenGroups((all) => {
                          const next = new Set(all);
                          if (next.has(g.name)) next.delete(g.name);
                          else next.add(g.name);
                          return next;
                        })
                      }
                      aria-expanded={open}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-gray-900 dark:text-gray-50">{g.name}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {g.items
                            .slice(0, 3)
                            .map((r) => `${r.quantity > 1 ? `${r.quantity}× ` : ""}${KIT_ITEMS[r.item]?.short ?? r.item}`)
                            .join(", ")}
                          {g.items.length > 3 ? ` +${g.items.length - 3} more` : ""} · {formatDate(g.latest)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          waiting.length ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                        }`}
                      >
                        {waiting.length ? `${count(waiting)} to sort` : "Done"}
                      </span>
                      <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="border-t border-gray-100 px-4 pb-3 dark:border-white/10">
                        <ul className="divide-y divide-gray-100 dark:divide-white/10">
                          {g.items.map((r) => (
                            <li key={r.id} className={`flex items-start gap-3 py-2.5 ${r.doneAt ? "opacity-60" : ""}`}>
                              <span className="text-2xl leading-none">{KIT_ITEMS[r.item]?.emoji}</span>
                              <span className="min-w-0 flex-1">
                                <span className={`block font-semibold text-gray-900 dark:text-gray-50 ${r.doneAt ? "line-through" : ""}`}>
                                  {r.quantity > 1 ? `${r.quantity} × ` : ""}
                                  {KIT_ITEMS[r.item]?.label ?? r.item} · {r.size}
                                </span>
                                {r.note && <span className="block text-sm italic text-gray-500 dark:text-gray-400">“{r.note}”</span>}
                                <span className="block text-xs text-gray-400">
                                  Asked by {r.requestedBy} · {formatDate(r.createdAt)}
                                  {r.doneAt ? ` · Done ${formatDate(r.doneAt)}` : ""}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                <button
                                  onClick={() => changeRequest(r.id, { done: !r.doneAt })}
                                  className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                                    r.doneAt ? "border border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300" : "bg-green-600 text-white hover:bg-green-700"
                                  }`}
                                >
                                  {r.doneAt ? "Undo" : "✓ Done"}
                                </button>
                                <button
                                  onClick={() => changeRequest(r.id, { remove: true })}
                                  className="h-8 w-8 cursor-pointer text-lg leading-none text-gray-300 hover:text-red-400"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                        {waiting.length > 1 && (
                          <button
                            onClick={async () => {
                              for (const r of waiting) await changeRequest(r.id, { done: true });
                            }}
                            className="mt-1 w-full cursor-pointer rounded-xl bg-green-600 py-2 text-sm font-bold text-white hover:bg-green-700"
                          >
                            ✓ Mark All Done for {g.name.split(" ")[0]}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* for ordering: everything asked for, and the totals still to order */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => downloadOrderTotals(requests, team)}
                disabled={!requests.some((r) => !r.doneAt)}
                className="cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-40"
              >
                ⬇ Order Totals CSV
              </button>
              <button
                onClick={() => downloadRequests(requests, team)}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-200 dark:hover:bg-white/5"
              >
                ⬇ All Requests CSV
              </button>
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
        <div className="flex flex-wrap gap-3 mb-5">
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
          <button
            onClick={() => downloadSizeTotals(sorted, team, extrasIn(sorted, CLUB.kitExtras))}
            disabled={submissions.length === 0}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-40 cursor-pointer dark:hover:bg-white/5 dark:bg-[#1c1c1e] dark:text-gray-200 dark:border-white/15"
          >
            ⬇ Size Totals CSV
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
