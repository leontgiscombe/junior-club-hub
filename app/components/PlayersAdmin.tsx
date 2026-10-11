"use client";

// Coach Admin → Players: the club's squad, team by team, with each player's
// parents. Parents' children join the squad when a coach approves them; the
// club puts each player in a team here (and it's the same squad the match log,
// stats and kit forms use).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SESSION_KEY } from "@/lib/access";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { TopBar } from "./SettingsUI";

type TeamOption = { slug: string; name: string };
type SquadPlayer = {
  id: string;
  name: string;
  team: string;
  parents: { name: string; email: string }[];
  requestedTeam?: TeamOption;
};
type Snapshot = { teams: TeamOption[]; players: SquadPlayer[]; canDelete: boolean };

export default function PlayersAdmin() {
  const [key, setKey] = useState("");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  // a coach password that worked here opens every other tool too
  useEffect(() => {
    if (snap) rememberCoachKey(key);
  }, [snap, key]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (k: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players?key=${encodeURIComponent(k)}`, { cache: "no-store" });
      if (res.status === 401) throw new Error("Incorrect password");
      if (!res.ok) throw new Error("Could not load the players. Please try again.");
      setSnap(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    // opened from Search: start filtered to what was found
    const urlQuery = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser
    if (urlQuery) setSearch(urlQuery);
    let cancelled = false;
    const t = setTimeout(async () => {
      if (urlKey) {
        setKey(urlKey);
        await load(urlKey);
        setChecking(false);
        return;
      }
      // signed in with an account, or the coach password given earlier: no password box
      const k = await accountKey();
      if (!cancelled && k) {
        setKey(k);
        await load(k);
      }
      if (!cancelled) setChecking(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [load]);

  async function move(id: string, team: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, team }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      setSnap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: SquadPlayer) {
    if (
      !confirm(
        `Delete ${p.name} from the squad? Their season stats go too${p.parents.length ? `, and they come off ${p.parents.map((x) => x.name).join(" and ")}'s list of children` : ""}. This can't be undone (except from a backup).`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players?key=${encodeURIComponent(key)}&id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      setSnap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (!snap) {
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl dark:bg-[#1c1c1e]">
          <div className="mb-6 text-center">
            <div className="mb-2 text-3xl">🧒</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Players</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coaches only</p>
          </div>
          <input
            type="password"
            value={key === SESSION_KEY ? "" : key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="mb-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
          />
          {error && <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={busy || !key}
            className="w-full cursor-pointer rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {busy ? "Loading…" : "Open Players"}
          </button>
          <Link href="/admin" className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400">
            ← Coach Admin
          </Link>
        </div>
      </main>
    );
  }

  const q = search.trim().toLowerCase();
  const shown = q
    ? snap.players.filter((p) => [p.name, ...p.parents.map((x) => x.name)].some((v) => v.toLowerCase().includes(q)))
    : snap.players;
  const groups = [
    { key: "", title: "Not in a team yet", players: shown.filter((p) => !p.team) },
    ...snap.teams.map((t) => ({ key: t.slug, title: t.name, players: shown.filter((p) => p.team === t.slug) })),
  ];

  return (
    <main className="themed min-h-screen bg-gray-100 dark:bg-black dark:text-gray-50 pb-16">
      <TopBar title="Players" href={`/admin${keyQuery(key)}`} />
      <div className="mx-auto max-w-2xl px-4">
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Parents&apos; children join here when you approve them in Members. Choose each player&apos;s team —
          it&apos;s the same squad the Match Log, Stats and Kit Sizes use.
        </p>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players or parents"
          className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
        />
        {groups.map((g) =>
          g.key === "" && g.players.length === 0 ? null : (
            <section key={g.key || "none"} className={`mt-4 rounded-2xl border bg-white p-4 shadow-sm ${g.key ? "border-gray-100 dark:border-white/10" : "border-amber-200 dark:border-amber-400/30"}`}>
              <h2 className="font-extrabold text-gray-900 dark:text-gray-50">
                {g.key ? g.title : `⚠️ ${g.title}`} <span className="font-semibold text-gray-500 dark:text-gray-400">({g.players.length})</span>
              </h2>
              {g.players.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No players yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100 dark:divide-white/10">
                  {g.players.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-gray-900 dark:text-gray-50">{p.name}</span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          {[
                            p.parents.length ? `Parent: ${p.parents.map((x) => x.name).join(", ")}` : "No parent account yet",
                            !p.team && p.requestedTeam ? `asked for ${p.requestedTeam.name}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                      <select
                        value={p.team}
                        onChange={(e) => move(p.id, e.target.value)}
                        disabled={busy}
                        aria-label={`${p.name}'s team`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
                      >
                        <option value="">No team yet</option>
                        {snap.teams.map((t) => (
                          <option key={t.slug} value={t.slug}>{t.name}</option>
                        ))}
                      </select>
                      {snap.canDelete && (
                        <button
                          onClick={() => remove(p)}
                          disabled={busy}
                          aria-label={`Delete ${p.name}`}
                          className="rounded-lg px-2 py-2 text-sm font-semibold text-gray-400 hover:text-red-600 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ),
        )}
      </div>
    </main>
  );
}
