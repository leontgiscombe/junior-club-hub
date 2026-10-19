"use client";

// The platform admin: sign in with PLATFORM_ADMIN_KEY, then see how every
// club is doing (members, players, last used, how far it's got setting up),
// open one for its admins, notes and actions — send a password reset, pause
// or resume it, delete it — and restore a club from a backup. The key is kept
// for this browser tab only.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useScrollLock } from "../../components/useScrollLock";
import { FEATURES, type Feature } from "@/lib/clubSettings";
import { PLANS, PLAN_IDS, billingState, planForTeams, type Billing, type PlanId } from "@/lib/billing";

type AdminClub = {
  billing?: Billing;
  id: string;
  name: string;
  email: string;
  createdAt: string;
  paused?: { at: string; reason?: string };
  lastActive: string | null;
  members: number;
  waiting: number;
  coaches: number;
  parents: number;
  players: number;
  teams: number;
  matches: number;
  training: number;
  invites: number;
  private: boolean;
  features: Feature[];
  setup: { crest: boolean; members: boolean; squad: boolean; logged: boolean };
  admins: { name: string; email: string; phone?: string }[];
  notes: string;
};
type Backup = { date: string; at: string; keys: number };
type LogEntry = { at: string; action: string; club: string; detail?: string };
type Action = { action: string; id: string; confirm?: string; date?: string; reason?: string; text?: string; feedbackId?: string; done?: boolean; op?: string; plan?: string; months?: number };
type Feedback = { id: string; kind: "question" | "problem" | "idea"; message: string; name: string; email: string; club: string; page: string; device: string; at: string; done?: boolean };
const KIND = { question: "❓ Question", problem: "🐞 Problem", idea: "💡 Suggestion" } as const;

const KEY_STORE = "platform-admin-key";
const DAY = 86400_000;
const SETUP: { key: keyof AdminClub["setup"]; label: string }[] = [
  { key: "crest", label: "Crest added" },
  { key: "members", label: "Someone besides the admin has joined" },
  { key: "squad", label: "Players in the squad" },
  { key: "logged", label: "A game or training session logged" },
];

const clubUrl = (id: string, root: string) => `${/^localhost(:|$)/.test(root) ? "http" : "https"}://${id}.${root}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ago = (iso: string | null) => {
  if (!iso) return "never used";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? "used today" : d === 1 ? "used yesterday" : d < 30 ? `used ${d} days ago` : `used ${day(iso)}`;
};
const within = (iso: string | null, days: number) => !!iso && Date.now() - new Date(iso).getTime() < days * DAY;
const setupDone = (c: AdminClub) => Object.values(c.setup).filter(Boolean).length;

type Filter = "all" | "active" | "quiet" | "setting-up" | "paused";
type Sort = "newest" | "active" | "members" | "name";

export default function PlatformAdmin({ rootDomain }: { rootDomain: string }) {
  const [key, setKey] = useState("");
  const [typedKey, setTypedKey] = useState("");
  const [clubs, setClubs] = useState<AdminClub[] | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [emailReady, setEmailReady] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [separateBackups, setSeparateBackups] = useState(true);
  const [restoreId, setRestoreId] = useState("");
  const [restoreDate, setRestoreDate] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (k: string, init?: Action) => {
    const res = await fetch("/api/platform-admin", {
      method: init ? "POST" : "GET",
      headers: { "x-platform-key": k, ...(init ? { "Content-Type": "application/json" } : {}) },
      body: init ? JSON.stringify(init) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error ?? "Something went wrong"), { status: res.status });
    return data;
  }, []);

  const load = useCallback(
    async (k: string) => {
      setBusy(true);
      setError(null);
      try {
        const data = await call(k);
        setClubs(data.clubs);
        setLog(data.log ?? []);
        setFeedback(data.feedback ?? []);
        setEmailReady(data.emailConfigured);
        setBackups(data.backups ?? []);
        setSeparateBackups(data.separateBackups ?? true);
        setKey(k);
        try {
          sessionStorage.setItem(KEY_STORE, k);
        } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        if ((err as { status?: number }).status === 401) {
          setKey("");
          try {
            sessionStorage.removeItem(KEY_STORE);
          } catch {}
        }
      } finally {
        setBusy(false);
      }
    },
    [call],
  );

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(KEY_STORE) ?? "";
    } catch {}
    // (after this render, so the effect itself doesn't set state)
    if (saved) void Promise.resolve().then(() => load(saved));
  }, [load]);

  async function act(body: Action, after?: () => void): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await call(key, body);
      setNotice(data.message);
      after?.();
      await load(key);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const overview = useMemo(() => {
    const all = clubs ?? [];
    const now = new Date();
    return {
      clubs: all.length,
      newThisMonth: all.filter((c) => {
        const d = new Date(c.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length,
      active7: all.filter((c) => within(c.lastActive, 7)).length,
      active30: all.filter((c) => within(c.lastActive, 30)).length,
      members: all.reduce((s, c) => s + c.members, 0),
      players: all.reduce((s, c) => s + c.players, 0),
      paused: all.filter((c) => c.paused).length,
    };
  }, [clubs]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (clubs ?? []).filter((c) => {
      if (q && ![c.id, c.name, c.email, ...c.admins.flatMap((a) => [a.name, a.email])].some((v) => v.toLowerCase().includes(q))) return false;
      if (filter === "active") return within(c.lastActive, 30) && !c.paused;
      if (filter === "quiet") return !within(c.lastActive, 30) && !c.paused;
      if (filter === "setting-up") return setupDone(c) < SETUP.length && !c.paused;
      if (filter === "paused") return !!c.paused;
      return true;
    });
    const by: Record<Sort, (a: AdminClub, b: AdminClub) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      active: (a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""),
      members: (a, b) => b.members - a.members || b.players - a.players,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [clubs, search, filter, sort]);

  if (!key || !clubs) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(typedKey.trim());
        }}
        className="mt-6 max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-lg"
      >
        <label className="block text-sm font-bold text-gray-700" htmlFor="admin-key">
          Admin key
        </label>
        <input
          id="admin-key"
          type="password"
          autoComplete="current-password"
          value={typedKey}
          onChange={(e) => setTypedKey(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-green-600 focus:outline-none"
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !typedKey.trim()}
          className="mt-4 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Sign In"}
        </button>
      </form>
    );
  }

  const openClub = open ? clubs.find((c) => c.id === open) ?? null : null;
  const tiles: [string, number, string?][] = [
    ["Clubs", overview.clubs, overview.paused ? `${overview.paused} paused` : undefined],
    ["New this month", overview.newThisMonth],
    ["Active, last 7 days", overview.active7],
    ["Active, last 30 days", overview.active30],
    ["Members", overview.members],
    ["Players", overview.players],
  ];
  const field = "rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-green-600 focus:outline-none";

  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, n, sub]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-3xl font-extrabold tabular-nums text-gray-900">{n}</p>
            <p className="text-sm text-gray-500">{label}</p>
            {sub && <p className="text-xs font-semibold text-amber-700">{sub}</p>}
          </div>
        ))}
      </div>

      {!emailReady && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          Email isn&apos;t set up yet (RESEND_API_KEY and EMAIL_FROM), so emails go to the server log.
        </p>
      )}
      {notice && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800">{notice}</p>}
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search clubs, addresses or admins"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${field} min-w-0 flex-1 basis-56`}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Show" className={field}>
          <option value="all">All clubs</option>
          <option value="active">Active (last 30 days)</option>
          <option value="quiet">Quiet (not used in 30 days)</option>
          <option value="setting-up">Still setting up</option>
          <option value="paused">Paused</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className={field}>
          <option value="newest">Newest first</option>
          <option value="active">Last used</option>
          <option value="members">Most members</option>
          <option value="name">Name</option>
        </select>
        <button onClick={() => load(key)} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-4 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
          Refresh
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          {clubs.length ? "No clubs match." : "No clubs have signed up yet."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {shown.map((c) => {
            const done = setupDone(c);
            return (
              <li key={c.id}>
                <button onClick={() => { setOpen(c.id); setNotice(null); setError(null); }} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-gray-900">{c.name}</span>
                      {c.paused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Paused</span>}
                      {c.waiting > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{c.waiting} waiting</span>}
                    </span>
                    <span className="block truncate text-sm text-gray-500">
                      {c.id}.{rootDomain} · joined {day(c.createdAt)}
                    </span>
                    <span className="block truncate text-sm text-gray-700">
                      {c.members} members · {c.players} players · {c.teams} team{c.teams === 1 ? "" : "s"} ·{" "}
                      <span className={within(c.lastActive, 30) ? "text-green-700" : "text-gray-500"}>{ago(c.lastActive)}</span>
                    </span>
                  </span>
                  {/* how far it's got setting up */}
                  <span className="flex shrink-0 flex-col items-end gap-1" title={`${done} of ${SETUP.length} set up`}>
                    <span className="flex gap-1">
                      {SETUP.map((s) => (
                        <span key={s.key} className={`h-2.5 w-2.5 rounded-full ${c.setup[s.key] ? "bg-green-600" : "bg-gray-200"}`} />
                      ))}
                    </span>
                    <span className="text-xs text-gray-500">
                      {done}/{SETUP.length} set up
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openClub && (
        <ClubPanel
          club={openClub}
          rootDomain={rootDomain}
          busy={busy}
          log={log.filter((l) => l.club === openClub.id)}
          notice={notice}
          error={error}
          onClose={() => setOpen(null)}
          act={act}
        />
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="font-extrabold text-gray-900">🗄️ Backups</h2>
        <p className="mt-1 text-sm text-gray-500">
          Everything is backed up every morning and kept for 7 days.
          {!separateBackups && " They're in the main database for now — add a second Upstash database (BACKUP_KV_REST_API_URL / BACKUP_KV_REST_API_TOKEN) so they'd survive losing it."}
        </p>
        {backups.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No backups yet — the first runs at 9am UTC.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {backups.map((b) => (
              <li key={b.date}>
                <strong>{day(b.date)}</strong> · {new Date(b.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {b.keys} records
              </li>
            ))}
          </ul>
        )}
        {backups.length > 0 && (
          <div className="mt-4 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-bold text-gray-800">Restore a club</p>
            <p className="mt-1 text-xs text-gray-500">Puts one club back exactly as it was in that backup, replacing what it has now. Works for a deleted club too.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={restoreId}
                onChange={(e) => setRestoreId(e.target.value.trim().toLowerCase())}
                placeholder="club address"
                aria-label="Club address to restore"
                className="min-w-0 flex-1 basis-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
              />
              <select value={restoreDate} onChange={(e) => setRestoreDate(e.target.value)} aria-label="Backup to restore from" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
                <option value="">Which backup…</option>
                {backups.map((b) => (
                  <option key={b.date} value={b.date}>
                    {day(b.date)}
                  </option>
                ))}
              </select>
            </div>
            {restoreId && restoreDate && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.value)}
                  placeholder={`type ${restoreId} to confirm`}
                  aria-label="Type the club's address to confirm"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 basis-40 rounded-lg border border-amber-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
                />
                <button
                  onClick={() => act({ action: "restore", id: restoreId, confirm: restoreConfirm.trim().toLowerCase(), date: restoreDate }, () => setRestoreConfirm(""))}
                  disabled={busy || restoreConfirm.trim().toLowerCase() !== restoreId}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Restore Club
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-extrabold text-gray-900">
            💬 Feedback{feedback.some((f) => !f.done) ? ` (${feedback.filter((f) => !f.done).length} new)` : ""}
          </h2>
          {feedback.some((f) => f.done) && (
            <button onClick={() => setShowDone(!showDone)} className="text-sm font-semibold text-gray-500 hover:text-gray-800">
              {showDone ? "Hide done" : "Show done"}
            </button>
          )}
        </div>
        {feedback.filter((f) => showDone || !f.done).length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nothing new. Questions, problems and suggestions from Help &amp; Feedback land here (and in your email).</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {feedback
              .filter((f) => showDone || !f.done)
              .map((f) => (
                <li key={f.id} className={`py-3 ${f.done ? "opacity-50" : ""}`}>
                  <p className="text-xs font-semibold text-gray-500">
                    {KIND[f.kind] ?? f.kind} · {new Date(f.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {f.club ? ` · ${f.club}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{f.message}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {f.name ? `${f.name} · ` : ""}
                    <a href={`mailto:${f.email}?subject=${encodeURIComponent(`Re: your ${KIND[f.kind]?.split(" ")[1]?.toLowerCase() ?? "message"}`)}`} className="font-semibold text-green-700 underline">
                      {f.email}
                    </a>
                    {f.page ? ` · from ${f.page}` : ""}
                  </p>
                  {f.device && <p className="mt-0.5 truncate text-[11px] text-gray-400">{f.device}</p>}
                  <button
                    onClick={() => act({ action: "feedbackDone", id: "", feedbackId: f.id, done: !f.done })}
                    disabled={busy}
                    className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {f.done ? "Not Done" : "Mark Done"}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="font-extrabold text-gray-900">📋 What You&apos;ve Done</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nothing yet. Resets, pauses, restores and deletions are listed here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {log.map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <strong>{l.action}</strong> · {l.club}
                  {l.detail && <span className="text-gray-500"> · {l.detail}</span>}
                </span>
                <span className="text-gray-500">
                  {day(l.at)} {new Date(l.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => {
          try {
            sessionStorage.removeItem(KEY_STORE);
          } catch {}
          setKey("");
          setClubs(null);
          setTypedKey("");
        }}
        className="text-sm font-semibold text-gray-500 hover:text-gray-800"
      >
        Sign out
      </button>
    </div>
  );
}

/** One club: its numbers, setup, admins, the admin's notes, and what can be done to it. */
function ClubPanel({
  club: c,
  rootDomain,
  busy,
  log,
  notice,
  error,
  onClose,
  act,
}: {
  club: AdminClub;
  rootDomain: string;
  busy: boolean;
  log: LogEntry[];
  notice: string | null;
  error: string | null;
  onClose: () => void;
  act: (body: Action, after?: () => void) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState(c.notes);
  const [reason, setReason] = useState("");
  const [pausing, setPausing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  // the page behind stays still, and Escape closes it
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats: [string, number][] = [
    ["Members", c.members],
    ["Coaches", c.coaches],
    ["Parents", c.parents],
    ["Players", c.players],
    ["Teams", c.teams],
    ["Games logged", c.matches],
    ["Training sessions", c.training],
    ["Invites waiting", c.invites],
  ];
  const btn = "rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.name}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto bg-gray-50 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-gray-900">{c.name}</h2>
            <a href={clubUrl(c.id, rootDomain)} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-green-700 underline">
              {c.id}.{rootDomain}
            </a>
            <p className="text-sm text-gray-500">
              Joined {day(c.createdAt)} · {ago(c.lastActive)}
              {c.private ? " · only approved members" : " · open to anyone with the link"}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-gray-700 shadow-sm">
            Close
          </button>
        </div>

        <BillingPanel c={c} busy={busy} act={act} />

        {notice && <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800">{notice}</p>}
        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {c.paused && (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Paused</strong> since {day(c.paused.at)}
            {c.paused.reason ? ` — ${c.paused.reason}` : ""}. Its hub shows a &ldquo;paused&rdquo; page; everything is kept.
          </p>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          {stats.map(([label, n]) => (
            <div key={label} className="rounded-xl bg-white p-3">
              <p className="text-xl font-extrabold tabular-nums text-gray-900">{n}</p>
              <p className="text-xs leading-tight text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        {c.waiting > 0 && <p className="mt-2 text-sm font-semibold text-red-700">{c.waiting} waiting for the club to approve them.</p>}

        <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">Setting Up</h3>
        <ul className="mt-2 space-y-1 rounded-2xl bg-white p-3 text-sm">
          {SETUP.map((s) => (
            <li key={s.key} className={c.setup[s.key] ? "text-gray-900" : "text-gray-400"}>
              {c.setup[s.key] ? "✓" : "○"} {s.label}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">Parts of the Hub in Use</h3>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(FEATURES) as Feature[]).map((f) => (
            <span key={f} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.features.includes(f) ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-400 line-through"}`}>
              {FEATURES[f].label}
            </span>
          ))}
        </p>

        <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">Contacts</h3>
        <ul className="mt-2 divide-y divide-gray-100 rounded-2xl bg-white text-sm">
          <li className="p-3">
            <span className="block font-semibold text-gray-900">Club email</span>
            <a href={`mailto:${c.email}`} className="text-green-700 underline">
              {c.email}
            </a>
          </li>
          {c.admins.map((a) => (
            <li key={a.email} className="p-3">
              <span className="block font-semibold text-gray-900">{a.name} · club admin</span>
              <a href={`mailto:${a.email}`} className="text-green-700 underline">
                {a.email}
              </a>
              {a.phone && (
                <>
                  {" · "}
                  <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="text-green-700 underline">
                    {a.phone}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">Your Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="e.g. Spoke to Dave 12 Oct — wants a demo for the committee"
          className="mt-2 w-full rounded-2xl border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-green-600 focus:outline-none"
        />
        <button onClick={() => act({ action: "notes", id: c.id, text: notes })} disabled={busy || notes === c.notes} className={`mt-1 ${btn}`}>
          Save Notes
        </button>

        <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">Actions</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={clubUrl(c.id, rootDomain)} target="_blank" rel="noreferrer" className={btn}>
            Open Hub
          </a>
          <a href={`mailto:${c.email}?subject=${encodeURIComponent(`${c.name} on the club hub`)}`} className={btn}>
            Email the Club
          </a>
          <button onClick={() => act({ action: "reset", id: c.id })} disabled={busy} className={btn}>
            Send Password Reset
          </button>
          {/* a demo club for App Review or showing people: only an empty one */}
          {c.players === 0 && (
            <button
              onClick={() => confirm(`Fill ${c.name} with made-up teams, players and games?`) && act({ action: "demo", id: c.id })}
              disabled={busy}
              className={btn}
            >
              Fill With Demo Data
            </button>
          )}
          {c.paused ? (
            <button onClick={() => act({ action: "resume", id: c.id })} disabled={busy} className="rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              Resume Club
            </button>
          ) : (
            <button onClick={() => setPausing(!pausing)} disabled={busy} className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
              Pause Club
            </button>
          )}
          <button
            onClick={() => {
              setDeleting(!deleting);
              setConfirmText("");
            }}
            disabled={busy}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        {pausing && !c.paused && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Its hub will show a &ldquo;paused&rdquo; page to everyone, coaches included, until you resume it. Nothing is deleted.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why (only you see this), e.g. unpaid since Sept"
                maxLength={200}
                className="min-w-0 flex-1 basis-48 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none"
              />
              <button
                onClick={() => act({ action: "pause", id: c.id, reason }, () => setPausing(false))}
                disabled={busy}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Pause Club
              </button>
            </div>
          </div>
        )}

        {deleting && (
          <div className="mt-3 rounded-xl bg-red-50 p-3">
            <p className="text-sm text-red-800">
              This deletes <strong>{c.name}</strong> and everything in its hub, for good (a backup from the last 7 days can bring it back). Type{" "}
              <strong>{c.id}</strong> to confirm.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                aria-label="Type the club's address to confirm"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 basis-40 rounded-lg border border-red-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (await act({ action: "delete", id: c.id, confirm: confirmText.trim().toLowerCase() })) onClose();
                }}
                // a phone's keyboard capitalises and adds spaces: those don't count
                disabled={busy || confirmText.trim().toLowerCase() !== c.id}
                className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete Club
              </button>
            </div>
          </div>
        )}

        {log.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-gray-500">History</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {log.map((l, i) => (
                <li key={i}>
                  {day(l.at)} · <strong>{l.action}</strong>
                  {l.detail ? ` · ${l.detail}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** A club's free trial or plan (lib/billing.ts), and the platform admin's changes to it. */
function BillingPanel({ c, busy, act }: { c: AdminClub & { teams?: number }; busy: boolean; act: (body: Action) => Promise<boolean> }) {
  const state = billingState(c.billing);
  const [plan, setPlan] = useState<PlanId>(planForTeams(Math.max(c.teams ?? 1, 1)));
  const [months, setMonths] = useState(12);
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const small = "rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  return (
    <section className="mt-4 rounded-2xl bg-white p-4">
      <h3 className="font-extrabold text-gray-900">Plan</h3>
      <p className="mt-1 text-sm text-gray-700">
        {state.kind === "free"
          ? `Free — ${state.reason}`
          : state.kind === "paid"
            ? `${PLANS[state.plan].name}, paid up to ${date(state.until)}`
            : state.kind === "trial"
              ? `Free trial: ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left (ends ${date(state.endsAt)})`
              : `Trial ended ${date(state.endedAt)} — the hub is paused until it has a plan`}
        {typeof c.teams === "number" && ` · ${c.teams} team${c.teams === 1 ? "" : "s"}, needs ${PLANS[planForTeams(Math.max(c.teams, 1))].name}`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {state.kind !== "free" && (
          <button onClick={() => act({ action: "billing", id: c.id, op: "extend" })} disabled={busy} className={small}>
            Trial +30 Days
          </button>
        )}
        {state.kind === "free" ? (
          <button onClick={() => confirm(`Make ${c.name} pay (after a trial)?`) && act({ action: "billing", id: c.id, op: "unfree" })} disabled={busy} className={small}>
            Stop Being Free
          </button>
        ) : (
          <button
            onClick={() => {
              const reason = prompt("Why is it free? (e.g. Founding club, Friend)", "Free");
              if (reason !== null) act({ action: "billing", id: c.id, op: "free", reason });
            }}
            disabled={busy}
            className={small}
          >
            Make Free
          </button>
        )}
        {state.kind === "paid" && (
          <button onClick={() => confirm(`Remove ${c.name}'s plan?`) && act({ action: "billing", id: c.id, op: "unpaid" })} disabled={busy} className={small}>
            Remove Plan
          </button>
        )}
      </div>
      {state.kind !== "free" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-500">Paid another way:</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className="rounded-lg border border-gray-200 px-2 py-1.5">
            {PLAN_IDS.map((p) => (
              <option key={p} value={p}>
                {PLANS[p].name}
              </option>
            ))}
          </select>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-lg border border-gray-200 px-2 py-1.5">
            {[1, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m} month{m === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <button onClick={() => act({ action: "billing", id: c.id, op: "paid", plan, months })} disabled={busy} className={small}>
            Mark Paid
          </button>
        </div>
      )}
    </section>
  );
}
