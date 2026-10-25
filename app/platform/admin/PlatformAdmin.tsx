"use client";

// The platform admin: sign in with PLATFORM_ADMIN_KEY, then see how every
// club is doing (members, players, last used, its plan, how far it's got
// setting up), open one for its admins, notes and actions — send a password
// reset, pause or resume it, delete it — and restore a club from a backup.
// Laid out like the hub's own screens: a large title, tabs, rounded groups,
// and a sheet for each club. Signed in to your own account with a passkey
// (lib/platformAdmin.ts) it opens straight away; otherwise the admin key, kept
// for this browser tab only.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useScrollLock } from "../../components/useScrollLock";
import { cancelled, signInWithPasskey, supportsPasskeys } from "../../components/passkey";
import { FEATURES, type Feature } from "@/lib/clubSettings";
import { PLANS, PLAN_IDS, billingState, planForTeams, price, type Billing, type PlanId } from "@/lib/billing";
import { ask, askText, toast } from "@/lib/dialog";

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
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const ago = (iso: string | null) => {
  if (!iso) return "never used";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? "used today" : d === 1 ? "used yesterday" : d < 30 ? `used ${d} days ago` : `used ${day(iso)}`;
};
const within = (iso: string | null, days: number) => !!iso && Date.now() - new Date(iso).getTime() < days * DAY;
const setupDone = (c: AdminClub) => Object.values(c.setup).filter(Boolean).length;

// the look, shared with the hub's own screens
const card = "rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-[#1c1c1e] dark:ring-white/10";
const muted = "text-gray-500 dark:text-gray-400";
const strong = "text-gray-900 dark:text-gray-50";
const field =
  "min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-white/10 dark:bg-[#1c1c1e] dark:text-gray-50";
const pill =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-gray-100 px-3.5 text-sm font-semibold text-gray-800 hover:bg-gray-200 disabled:opacity-40 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15";
// the top bar's round buttons, like the hub's back button (app/components/SettingsUI.tsx TopBar)
const roundBtn =
  "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-gray-900 shadow-md ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-40 dark:bg-[#1c1c1e] dark:text-gray-50 dark:ring-white/10 dark:hover:bg-white/5";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-green-700 px-4 font-bold text-white hover:bg-green-800 disabled:opacity-40";

/** A club's standing at a glance: its plan, trial or pause. */
function standing(c: AdminClub): { label: string; tone: string } {
  if (c.paused) return { label: "Paused", tone: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" };
  const s = billingState(c.billing);
  if (s.kind === "paid") return { label: PLANS[s.plan].name, tone: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300" };
  if (s.kind === "trial") return { label: `Trial · ${s.daysLeft}d`, tone: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300" };
  if (s.kind === "free") return { label: "Free", tone: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" };
  return { label: "Trial ended", tone: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300" };
}

// each club's own colour, from its address, for its initials
const AVATAR = ["bg-green-700", "bg-sky-700", "bg-violet-700", "bg-amber-600", "bg-rose-700", "bg-teal-700", "bg-indigo-700", "bg-orange-700"];
function Avatar({ c, big }: { c: AdminClub; big?: boolean }) {
  const hash = [...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const initials = c.name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join("");
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${AVATAR[hash % AVATAR.length]} ${big ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm"}`}>
      {initials}
    </span>
  );
}

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  clubs: icon(<><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><circle cx="12" cy="11" r="2.5" /></>),
  money: icon(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>),
  clock: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  pulse: icon(<path d="M3 12h4l2-6 4 12 2-6h6" />),
  people: icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 0 1 5 5" /></>),
  ball: icon(<><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /></>),
  search: icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  refresh: icon(<><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></>),
  out: icon(<><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>),
  open: icon(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>),
  mail: icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  key: icon(<><circle cx="8" cy="8" r="4.5" /><path d="M11 11l9 9M16 16l2-2M18.5 18.5l2-2" /></>),
  sparkle: icon(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />),
  pause: icon(<><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>),
  play: icon(<path d="M7 5v14l11-7z" />),
  bin: icon(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>),
  close: icon(<path d="M6 6l12 12M18 6 6 18" />),
  // bolder, as the hub's own back buttons are
  back: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  chevron: icon(<path d="m9 6 6 6-6 6" />),
  check: icon(<path d="m5 12 5 5 9-10" />),
};

type Filter = "all" | "active" | "quiet" | "setting-up" | "trial" | "paying" | "paused";
type Sort = "newest" | "active" | "members" | "name";
type Tab = "clubs" | "feedback" | "backups" | "activity";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["active", "Active"],
  ["trial", "On trial"],
  ["paying", "Paying"],
  ["setting-up", "Setting up"],
  ["quiet", "Quiet"],
  ["paused", "Paused"],
];

export default function PlatformAdmin({ rootDomain, platformName }: { rootDomain: string; platformName: string }) {
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
  const [tab, setTab] = useState<Tab>("clubs");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPasskey, setCanPasskey] = useState(false);

  // no key: the passkey session is what lets you in
  const call = useCallback(async (k: string, init?: Action) => {
    const res = await fetch("/api/platform-admin", {
      method: init ? "POST" : "GET",
      headers: { ...(k ? { "x-platform-key": k } : {}), ...(init ? { "Content-Type": "application/json" } : {}) },
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
          if (k) sessionStorage.setItem(KEY_STORE, k);
        } catch {}
        return true;
      } catch (err) {
        // quietly checking for a passkey session: not signed in isn't an error yet
        if (k || (err as { status?: number }).status !== 401) setError(err instanceof Error ? err.message : "Something went wrong");
        if ((err as { status?: number }).status === 401) {
          setKey("");
          try {
            sessionStorage.removeItem(KEY_STORE);
          } catch {}
        }
      } finally {
        setBusy(false);
      }
      return false;
    },
    [call],
  );

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(KEY_STORE) ?? "";
    } catch {}
    // (after this render, so the effect itself doesn't set state): the saved
    // key, or else whether you're signed in with a passkey
    void Promise.resolve().then(() => {
      setCanPasskey(supportsPasskeys());
      return load(saved);
    });
  }, [load]);

  async function passkeySignIn() {
    setError(null);
    try {
      await signInWithPasskey("/platform/admin");
    } catch (err) {
      if (!cancelled(err)) setError(err instanceof Error ? err.message : "That passkey didn't work");
      return;
    }
    if (!(await load(""))) setError("That account isn't one of the platform's admins.");
  }

  async function act(body: Action, after?: () => void): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await call(key, body);
      toast(data.message);
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

  function signOut() {
    try {
      sessionStorage.removeItem(KEY_STORE);
    } catch {}
    setKey("");
    setClubs(null);
    setTypedKey("");
  }

  const overview = useMemo(() => {
    const all = clubs ?? [];
    const now = new Date();
    const states = all.map((c) => (c.paused ? null : billingState(c.billing)));
    const paying = states.filter((s) => s?.kind === "paid");
    return {
      clubs: all.length,
      newThisMonth: all.filter((c) => {
        const d = new Date(c.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length,
      paying: paying.length,
      // roughly what paying clubs bring in a month, at the monthly prices
      monthly: paying.reduce((sum, s) => sum + (s?.kind === "paid" ? PLANS[s.plan].monthly : 0), 0),
      trial: states.filter((s) => s?.kind === "trial").length,
      trialEndingSoon: states.filter((s) => s?.kind === "trial" && s.daysLeft <= 7).length,
      active7: all.filter((c) => within(c.lastActive, 7)).length,
      members: all.reduce((s, c) => s + c.members, 0),
      players: all.reduce((s, c) => s + c.players, 0),
      paused: all.filter((c) => c.paused).length,
    };
  }, [clubs]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (clubs ?? []).filter((c) => {
      if (q && ![c.id, c.name, c.email, ...c.admins.flatMap((a) => [a.name, a.email])].some((v) => v.toLowerCase().includes(q))) return false;
      const kind = billingState(c.billing).kind;
      if (filter === "active") return within(c.lastActive, 30) && !c.paused;
      if (filter === "quiet") return !within(c.lastActive, 30) && !c.paused;
      if (filter === "setting-up") return setupDone(c) < SETUP.length && !c.paused;
      if (filter === "trial") return kind === "trial" && !c.paused;
      if (filter === "paying") return kind === "paid" && !c.paused;
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

  if (!clubs) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
        <Link href="/" aria-label={`Back to ${platformName}`} title={platformName} className={`${roundBtn} mb-6`}>
          {I.back}
        </Link>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(typedKey.trim());
          }}
          className={`${card} p-6`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-green-700 text-white">{I.key}</span>
          <h1 className={`mt-4 text-2xl font-extrabold tracking-tight ${strong}`}>Platform Admin</h1>
          <p className={`mt-1 text-sm ${muted}`}>Every club on {platformName}, and what you can do for each.</p>
          {canPasskey && (
            <>
              <button type="button" onClick={passkeySignIn} disabled={busy} className={`${primary} mt-5 w-full gap-2`}>
                {I.key}
                Sign In With Passkey
              </button>
              <p className={`mt-2 text-center text-xs ${muted}`}>Face ID or Touch ID, with the passkey on your own {platformName} account.</p>
              <div className={`my-5 flex items-center gap-3 text-xs ${muted}`}>
                <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                or use the admin key
                <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
              </div>
            </>
          )}
          <label className={`${canPasskey ? "" : "mt-5"} block text-sm font-semibold ${strong}`} htmlFor="admin-key">
            Admin key
          </label>
          <input
            id="admin-key"
            type="password"
            autoComplete="current-password"
            value={typedKey}
            onChange={(e) => setTypedKey(e.target.value)}
            className={`${field} mt-1 w-full`}
          />
          {error && <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={busy || !typedKey.trim()} className={`${canPasskey ? pill + " min-h-11" : primary} mt-4 w-full`}>
            {busy ? "Checking…" : "Sign In With Key"}
          </button>
        </form>
      </div>
    );
  }

  const openClub = open ? clubs.find((c) => c.id === open) ?? null : null;
  const newFeedback = feedback.filter((f) => !f.done).length;
  const tiles: { label: string; value: string | number; sub?: string; icon: React.ReactNode; tone: string }[] = [
    { label: "Clubs", value: overview.clubs, sub: overview.newThisMonth ? `${overview.newThisMonth} new this month` : undefined, icon: I.clubs, tone: "bg-green-700" },
    { label: "Paying", value: overview.paying, sub: overview.paying ? `≈ ${price(overview.monthly)} a month` : "none yet", icon: I.money, tone: "bg-emerald-600" },
    { label: "On trial", value: overview.trial, sub: overview.trialEndingSoon ? `${overview.trialEndingSoon} ending this week` : undefined, icon: I.clock, tone: "bg-sky-600" },
    { label: "Active this week", value: overview.active7, sub: overview.paused ? `${overview.paused} paused` : undefined, icon: I.pulse, tone: "bg-violet-600" },
    { label: "Members", value: overview.members, icon: I.people, tone: "bg-orange-600" },
    { label: "Players", value: overview.players, icon: I.ball, tone: "bg-teal-600" },
  ];
  const tabs: [Tab, string, number?][] = [
    ["clubs", "Clubs", clubs.length],
    ["feedback", "Feedback", newFeedback],
    ["backups", "Backups"],
    ["activity", "Activity"],
  ];

  return (
    <>
      {/* the bar along the top, as on the hub's other pages: a round back button to
          the platform, then refresh and sign out — no rule under it */}
      <div className="wp-bar sticky top-0 z-30 bg-[#f2f2f7]/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:bg-black/80">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-2">
          <Link href="/" aria-label={`Back to ${platformName}`} title={platformName} className={roundBtn}>
            {I.back}
          </Link>
          <span className="flex-1" />
          <button onClick={() => load(key)} disabled={busy} aria-label="Refresh" title="Refresh" className={`${roundBtn} ${busy ? "animate-pulse" : ""}`}>
            {I.refresh}
          </button>
          {/* with a passkey you're in as yourself: Back is the way out */}
          {key && (
            <button onClick={signOut} aria-label="Sign out" title="Sign out" className={roundBtn}>
              {I.out}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-5">
        <h1 className={`text-[34px] font-extrabold leading-tight tracking-tight ${strong}`}>Platform Admin</h1>
        <p className={`mt-0.5 text-[15px] ${muted}`}>How every club is getting on, and what you can do for it.</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((t) => (
            <div key={t.label} className={`${card} flex items-start justify-between gap-2 p-3.5`}>
              <div className="min-w-0">
                <p className={`text-[26px] font-extrabold leading-none tabular-nums ${strong}`}>{t.value}</p>
                <p className={`mt-1.5 text-sm font-semibold leading-tight ${strong}`}>{t.label}</p>
                {t.sub && <p className={`mt-0.5 text-xs ${muted}`}>{t.sub}</p>}
              </div>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${t.tone}`}>{t.icon}</span>
            </div>
          ))}
        </div>

        {!emailReady && (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
            Email isn&apos;t set up yet (RESEND_API_KEY and EMAIL_FROM), so emails go to the server log.
          </p>
        )}
        {!openClub && notice && <p role="status" className="mt-4 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-200">{notice}</p>}
        {!openClub && error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-200">{error}</p>}

        {/* the sections, as a segmented control */}
        <div role="tablist" aria-label="Sections" className="mt-6 flex gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
          {tabs.map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors ${
                tab === id ? "bg-white text-gray-900 shadow-sm dark:bg-[#3a3a3c] dark:text-gray-50" : "text-gray-600 dark:text-gray-300"
              }`}
            >
              {label}
              {!!count && (
                <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${id === "feedback" ? "bg-red-500 text-white" : "bg-black/10 dark:bg-white/15"}`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "clubs" && (
          <section className="mt-4">
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`}>{I.search}</span>
                <span className="sr-only">Search clubs</span>
                <input type="search" placeholder="Search clubs, addresses or admins" value={search} onChange={(e) => setSearch(e.target.value)} className={`${field} w-full pl-10`} />
              </label>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className={`${field} w-32 shrink-0 sm:w-40`}>
                <option value="newest">Newest</option>
                <option value="active">Last used</option>
                <option value="members">Most members</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {FILTERS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${
                    filter === id ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white text-gray-700 ring-1 ring-black/10 dark:bg-[#1c1c1e] dark:text-gray-200 dark:ring-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className={`${card} mt-3 p-8 text-center ${muted}`}>{clubs.length ? "No clubs match." : "No clubs have signed up yet."}</p>
            ) : (
              <ul className={`${card} mt-3 divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
                {shown.map((c) => {
                  const done = setupDone(c);
                  const s = standing(c);
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setOpen(c.id);
                          setNotice(null);
                          setError(null);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <Avatar c={c} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`font-bold ${strong}`}>{c.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.tone}`}>{s.label}</span>
                            {c.waiting > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{c.waiting} waiting</span>}
                          </span>
                          <span className={`mt-0.5 block text-[13px] ${muted}`}>
                            {c.members} member{c.members === 1 ? "" : "s"} · {c.players} player{c.players === 1 ? "" : "s"} · {c.teams} team{c.teams === 1 ? "" : "s"} ·{" "}
                            <span className={within(c.lastActive, 30) ? "text-green-700 dark:text-green-400" : ""}>{ago(c.lastActive)}</span>
                          </span>
                          {/* how far it's got setting up */}
                          <span className="mt-1.5 flex items-center gap-2" title={`${done} of ${SETUP.length} set up`}>
                            <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                              <span className={`h-full rounded-full ${done === SETUP.length ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${(done / SETUP.length) * 100}%` }} />
                            </span>
                            <span className={`text-[11px] ${muted}`}>
                              {done}/{SETUP.length} set up
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-gray-300 dark:text-gray-600">{I.chevron}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "feedback" && (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className={`text-sm ${muted}`}>Questions, problems and ideas from Help &amp; Feedback (also emailed to you).</p>
              {feedback.some((f) => f.done) && (
                <button onClick={() => setShowDone(!showDone)} className={`${pill} shrink-0`}>
                  {showDone ? "Hide Done" : "Show Done"}
                </button>
              )}
            </div>
            {feedback.filter((f) => showDone || !f.done).length === 0 ? (
              <p className={`${card} mt-3 p-8 text-center ${muted}`}>Nothing new.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {feedback
                  .filter((f) => showDone || !f.done)
                  .map((f) => (
                    <li key={f.id} className={`${card} p-4 ${f.done ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">{KIND[f.kind] ?? f.kind}</span>
                        <span className={`text-xs ${muted}`}>
                          {new Date(f.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {f.club ? ` · ${f.club}` : ""}
                        </span>
                      </div>
                      <p className={`mt-2 whitespace-pre-wrap text-[15px] ${strong}`}>{f.message}</p>
                      <p className={`mt-2 text-xs ${muted}`}>
                        {f.name ? `${f.name} · ` : ""}
                        <a href={`mailto:${f.email}?subject=${encodeURIComponent(`Re: your ${KIND[f.kind]?.split(" ")[1]?.toLowerCase() ?? "message"}`)}`} className="font-semibold text-green-700 underline dark:text-green-400">
                          {f.email}
                        </a>
                        {f.page ? ` · from ${f.page}` : ""}
                      </p>
                      {f.device && <p className="mt-0.5 truncate text-[11px] text-gray-400">{f.device}</p>}
                      <button onClick={() => act({ action: "feedbackDone", id: "", feedbackId: f.id, done: !f.done })} disabled={busy} className={`${pill} mt-3`}>
                        {!f.done && I.check}
                        {f.done ? "Not Done" : "Mark Done"}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}

        {tab === "backups" && (
          <section className="mt-4 space-y-4">
            <p className={`px-1 text-sm ${muted}`}>
              Everything is backed up every morning and kept for 7 days.
              {!separateBackups && " They're in the main database for now — add a second Upstash database (BACKUP_KV_REST_API_URL / BACKUP_KV_REST_API_TOKEN) so they'd survive losing it."}
            </p>
            {backups.length === 0 ? (
              <p className={`${card} p-8 text-center ${muted}`}>No backups yet — the first runs at 9am UTC.</p>
            ) : (
              <ul className={`${card} divide-y divide-gray-100 dark:divide-white/10`}>
                {backups.map((b) => (
                  <li key={b.date} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className={`font-semibold ${strong}`}>{day(b.date)}</span>
                    <span className={muted}>
                      {time(b.at)} · {b.keys} records
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {backups.length > 0 && (
              <div className={`${card} p-4`}>
                <p className={`font-bold ${strong}`}>Restore a club</p>
                <p className={`mt-1 text-sm ${muted}`}>Puts one club back exactly as it was in that backup, replacing what it has now. Works for a deleted club too.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={restoreId}
                    onChange={(e) => setRestoreId(e.target.value.trim().toLowerCase())}
                    placeholder="club address"
                    aria-label="Club address to restore"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`${field} min-w-0 flex-1 basis-40`}
                  />
                  <select value={restoreDate} onChange={(e) => setRestoreDate(e.target.value)} aria-label="Backup to restore from" className={field}>
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
                      className={`${field} min-w-0 flex-1 basis-40 border-amber-300 dark:border-amber-400/40`}
                    />
                    <button
                      onClick={() => act({ action: "restore", id: restoreId, confirm: restoreConfirm.trim().toLowerCase(), date: restoreDate }, () => setRestoreConfirm(""))}
                      disabled={busy || restoreConfirm.trim().toLowerCase() !== restoreId}
                      className="min-h-11 rounded-xl bg-amber-600 px-4 font-bold text-white hover:bg-amber-700 disabled:opacity-40"
                    >
                      Restore Club
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "activity" && (
          <section className="mt-4">
            <p className={`px-1 text-sm ${muted}`}>What you&apos;ve done here: resets, plans, pauses, restores and deletions.</p>
            {log.length === 0 ? (
              <p className={`${card} mt-3 p-8 text-center ${muted}`}>Nothing yet.</p>
            ) : (
              <ul className={`${card} mt-3 divide-y divide-gray-100 dark:divide-white/10`}>
                {log.map((l, i) => (
                  <li key={i} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className={strong}>
                        <strong>{l.action}</strong> · {l.club}
                      </span>
                      <span className={`text-xs ${muted}`}>
                        {day(l.at)} {time(l.at)}
                      </span>
                    </div>
                    {l.detail && <p className={`mt-0.5 ${muted}`}>{l.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

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
    </>
  );
}

/** A heading and its rounded group, as on the hub's settings screens. */
function Group({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className="mt-6">
      <h3 className={`mb-2 px-1 text-xs font-bold uppercase tracking-wide ${muted}`}>{title}</h3>
      <div className={`${card} ${className}`}>{children}</div>
    </section>
  );
}

/** One action in the club's list: its coloured icon, what it does, and a chevron. */
function ActionRow({ icon, tone, label, detail, onClick, href, disabled, danger }: { icon: React.ReactNode; tone: string; label: string; detail?: string; onClick?: () => void; href?: string; disabled?: boolean; danger?: boolean }) {
  const inner = (
    <>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${danger ? "text-red-600 dark:text-red-400" : strong}`}>{label}</span>
        {detail && <span className={`block truncate text-xs ${muted}`}>{detail}</span>}
      </span>
      <span className="shrink-0 text-gray-300 dark:text-gray-600">{I.chevron}</span>
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/5";
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/** One club: its plan, numbers, setup, admins, the admin's notes, and what can be done to it. */
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
    ["Games", c.matches],
    ["Training", c.training],
    ["Invites", c.invites],
  ];
  const done = setupDone(c);
  const s = standing(c);
  // on a phone a box opened at the bottom is under the keyboard: bring it up
  const reveal = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm sm:items-stretch sm:justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.name}
        onClick={(e) => e.stopPropagation()}
        className="themed flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#f2f2f7] shadow-2xl sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none dark:bg-black"
      >
        {/* the sheet's header stays put while the rest scrolls */}
        <div className="flex items-center gap-3 border-b border-black/5 bg-white/80 px-4 py-3 backdrop-blur-xl sm:pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-white/10 dark:bg-[#1c1c1e]/80">
          <Avatar c={c} big />
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-xl font-extrabold ${strong}`}>{c.name}</h2>
            <a href={clubUrl(c.id, rootDomain)} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-green-700 dark:text-green-400">
              {c.id}.{rootDomain}
            </a>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.tone}`}>{s.label}</span>
              <span className={`text-xs ${muted}`}>
                Joined {day(c.createdAt)} · {ago(c.lastActive)}
              </span>
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-200/80 text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-200">
            {I.close}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)]">
          {notice && <p role="status" className="mt-4 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-200">{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-200">{error}</p>}
          {c.paused && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              <strong>Paused</strong> since {day(c.paused.at)}
              {c.paused.reason ? ` — ${c.paused.reason}` : ""}. Its hub shows a &ldquo;paused&rdquo; page; everything is kept.
            </p>
          )}

          <BillingPanel c={c} busy={busy} act={act} />

          <Group title="The Club" className="grid grid-cols-4 gap-px overflow-hidden bg-gray-100 dark:bg-white/10">
            {stats.map(([label, n]) => (
              <div key={label} className="bg-white px-2 py-3 text-center dark:bg-[#1c1c1e]">
                <p className={`text-xl font-extrabold tabular-nums ${strong}`}>{n}</p>
                <p className={`text-[11px] ${muted}`}>{label}</p>
              </div>
            ))}
          </Group>
          {c.waiting > 0 && <p className="mt-2 px-1 text-sm font-semibold text-red-700 dark:text-red-400">{c.waiting} waiting for the club to approve them.</p>}
          <p className={`mt-2 px-1 text-xs ${muted}`}>{c.private ? "Only approved members can open the hub." : "Open to anyone with the link."}</p>

          <Group title={`Setting Up · ${done} of ${SETUP.length}`} className="p-4">
            <span className="flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
              <span className={`h-full rounded-full ${done === SETUP.length ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${(done / SETUP.length) * 100}%` }} />
            </span>
            <ul className="mt-3 space-y-2 text-sm">
              {SETUP.map((step) => (
                <li key={step.key} className={`flex items-center gap-2 ${c.setup[step.key] ? strong : "text-gray-400 dark:text-gray-500"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.setup[step.key] ? "bg-green-600 text-white" : "ring-1 ring-gray-300 dark:ring-white/20"}`}>
                    {c.setup[step.key] && <span className="scale-75">{I.check}</span>}
                  </span>
                  {step.label}
                </li>
              ))}
            </ul>
          </Group>

          <Group title="Parts of the Hub in Use" className="flex flex-wrap gap-1.5 p-4">
            {(Object.keys(FEATURES) as Feature[]).map((f) => (
              <span
                key={f}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  c.features.includes(f) ? "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300" : "bg-gray-100 text-gray-400 line-through dark:bg-white/5 dark:text-gray-500"
                }`}
              >
                {FEATURES[f].label}
              </span>
            ))}
          </Group>

          <Group title="Contacts" className="divide-y divide-gray-100 text-sm dark:divide-white/10">
            <div className="px-4 py-3">
              <span className={`block font-semibold ${strong}`}>Club email</span>
              <a href={`mailto:${c.email}`} className="text-green-700 dark:text-green-400">
                {c.email}
              </a>
            </div>
            {c.admins.map((a) => (
              <div key={a.email} className="px-4 py-3">
                <span className={`block font-semibold ${strong}`}>
                  {a.name} <span className={`font-normal ${muted}`}>· club admin</span>
                </span>
                <a href={`mailto:${a.email}`} className="text-green-700 dark:text-green-400">
                  {a.email}
                </a>
                {a.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="text-green-700 dark:text-green-400">
                      {a.phone}
                    </a>
                  </>
                )}
              </div>
            ))}
          </Group>

          <Group title="Your Notes" className="p-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="e.g. Spoke to Dave 12 Oct — wants a demo for the committee"
              className="w-full resize-y bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-50"
            />
            <div className="flex justify-end">
              <button onClick={() => act({ action: "notes", id: c.id, text: notes })} disabled={busy || notes === c.notes} className={pill}>
                Save Notes
              </button>
            </div>
          </Group>

          <Group title="Actions" className="divide-y divide-gray-100 overflow-hidden dark:divide-white/10">
            <ActionRow icon={I.open} tone="bg-green-700" label="Open Hub" detail="In a new tab" href={clubUrl(c.id, rootDomain)} />
            <ActionRow icon={I.mail} tone="bg-sky-600" label="Email the Club" detail={c.email} href={`mailto:${c.email}?subject=${encodeURIComponent(`${c.name} on the club hub`)}`} />
            <ActionRow icon={I.key} tone="bg-violet-600" label="Send Password Reset" detail="To the club's email" onClick={() => act({ action: "reset", id: c.id })} disabled={busy} />
            {/* a demo club for App Review or showing people: only an empty one */}
            {c.players === 0 && (
              <ActionRow
                icon={I.sparkle}
                tone="bg-teal-600"
                label="Fill With Demo Data"
                detail="Made-up teams, players and games"
                onClick={async () => await ask(`Fill ${c.name} with made-up teams, players and games?`) && act({ action: "demo", id: c.id })}
                disabled={busy}
              />
            )}
            {c.paused ? (
              <ActionRow icon={I.play} tone="bg-green-600" label="Resume Club" detail="Its hub opens again" onClick={() => act({ action: "resume", id: c.id })} disabled={busy} />
            ) : (
              <ActionRow
                icon={I.pause}
                tone="bg-amber-500"
                label="Pause Club"
                detail="Shows a paused page; nothing is deleted"
                onClick={() => {
                  setPausing(!pausing);
                  setDeleting(false);
                  reveal("pause-club-confirm");
                }}
                disabled={busy}
              />
            )}
            <ActionRow
              icon={I.bin}
              tone="bg-red-600"
              label="Delete Club"
              detail="Everything in its hub, for good"
              danger
              onClick={() => {
                setDeleting(!deleting);
                setPausing(false);
                setConfirmText("");
                reveal("delete-club-confirm");
              }}
              disabled={busy}
            />
          </Group>

          {pausing && !c.paused && (
            <div id="pause-club-confirm" className="mt-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-400/10">
              <p className="text-sm text-amber-900 dark:text-amber-200">Its hub will show a &ldquo;paused&rdquo; page to everyone, coaches included, until you resume it. Nothing is deleted.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why (only you see this), e.g. unpaid since Sept"
                  maxLength={200}
                  className={`${field} min-w-0 flex-1 basis-48 border-amber-300 dark:border-amber-400/40`}
                />
                <button
                  onClick={() => act({ action: "pause", id: c.id, reason }, () => setPausing(false))}
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-amber-600 px-4 font-bold text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  Pause Club
                </button>
              </div>
            </div>
          )}

          {deleting && (
            <div id="delete-club-confirm" className="mt-3 rounded-2xl bg-red-50 p-4 dark:bg-red-400/10">
              <p className="text-sm text-red-800 dark:text-red-200">
                This deletes <strong>{c.name}</strong> and everything in its hub, for good (a backup from the last 7 days can bring it back). Type <strong>{c.id}</strong> to confirm.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  aria-label="Type the club's address to confirm"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${field} min-w-0 flex-1 basis-40 border-red-300 dark:border-red-400/40`}
                />
                <button
                  onClick={async () => {
                    if (await act({ action: "delete", id: c.id, confirm: confirmText.trim().toLowerCase() })) onClose();
                  }}
                  // a phone's keyboard capitalises and adds spaces: those don't count
                  disabled={busy || confirmText.trim().toLowerCase() !== c.id}
                  className="min-h-11 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Delete Club
                </button>
              </div>
            </div>
          )}

          {log.length > 0 && (
            <Group title="History" className="divide-y divide-gray-100 text-sm dark:divide-white/10">
              {log.map((l, i) => (
                <div key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                  <span className={strong}>
                    <strong>{l.action}</strong>
                    {l.detail && <span className={muted}> · {l.detail}</span>}
                  </span>
                  <span className={`text-xs ${muted}`}>{day(l.at)}</span>
                </div>
              ))}
            </Group>
          )}
        </div>
      </div>
    </div>
  );
}

/** A club's free trial or plan (lib/billing.ts), and the platform admin's changes to it. */
function BillingPanel({ c, busy, act }: { c: AdminClub; busy: boolean; act: (body: Action) => Promise<boolean> }) {
  const state = billingState(c.billing);
  const [plan, setPlan] = useState<PlanId>(planForTeams(Math.max(c.teams ?? 1, 1)));
  const [months, setMonths] = useState(12);
  const needs = PLANS[planForTeams(Math.max(c.teams, 1))].name;
  const source = c.billing?.source === "apple" ? "through the App Store" : c.billing?.source === "web" ? "by card on the website" : c.billing?.source === "manual" ? "set by you" : "";
  return (
    <Group title="Plan" className="p-4">
      <p className={`text-[17px] font-bold ${strong}`}>
        {state.kind === "free"
          ? `Free — ${state.reason}`
          : state.kind === "paid"
            ? `${PLANS[state.plan].name}, paid up to ${day(state.until)}`
            : state.kind === "trial"
              ? `Free trial: ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left`
              : `Trial ended ${day(state.endedAt)}`}
      </p>
      <p className={`mt-0.5 text-sm ${muted}`}>
        {state.kind === "trial" && `Ends ${day(state.endsAt)} · `}
        {state.kind === "ended" && "The hub is paused until it has a plan · "}
        {state.kind === "paid" && source && `Paid ${source}${c.billing?.cancelled ? ", cancelled" : ""}${c.billing?.billingIssue ? ", last payment failed" : ""} · `}
        {c.teams} team{c.teams === 1 ? "" : "s"}, needs {needs}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {state.kind !== "free" && (
          <button onClick={() => act({ action: "billing", id: c.id, op: "extend" })} disabled={busy} className={pill}>
            Trial +30 Days
          </button>
        )}
        {state.kind === "free" ? (
          <button onClick={async () => await ask(`Make ${c.name} pay (after a trial)?`) && act({ action: "billing", id: c.id, op: "unfree" })} disabled={busy} className={pill}>
            Stop Being Free
          </button>
        ) : (
          <button
            onClick={async () => {
              const reason = await askText("Why is it free? (e.g. Founding club, Friend)", "Free");
              if (reason !== null) act({ action: "billing", id: c.id, op: "free", reason });
            }}
            disabled={busy}
            className={pill}
          >
            Make Free
          </button>
        )}
        {state.kind === "paid" && (
          <button onClick={async () => await ask(`Remove ${c.name}'s plan?`) && act({ action: "billing", id: c.id, op: "unpaid" })} disabled={busy} className={pill}>
            Remove Plan
          </button>
        )}
      </div>
      {state.kind !== "free" && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/10">
          <p className={`text-xs font-semibold ${muted}`}>Paid another way (bank transfer, cash…)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} aria-label="Plan" className={`${field} min-h-9 text-sm`}>
              {PLAN_IDS.map((p) => (
                <option key={p} value={p}>
                  {PLANS[p].name}
                </option>
              ))}
            </select>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="How long" className={`${field} min-h-9 text-sm`}>
              {[1, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <button onClick={() => act({ action: "billing", id: c.id, op: "paid", plan, months })} disabled={busy} className={pill}>
              Mark Paid
            </button>
          </div>
        </div>
      )}
    </Group>
  );
}
