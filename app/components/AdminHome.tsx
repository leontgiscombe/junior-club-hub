"use client";

import SetupCard from "./SetupCard";
import type { SetupStep } from "@/lib/setupChecklist";
import NoTabBar from "./NoTabBar";
import Link from "next/link";
import { backOr } from "@/lib/back";
import Image from "next/image";
import { Anton } from "next/font/google";
import { useEffect, useState, useCallback } from "react";
import { SESSION_KEY } from "@/lib/access";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import AppHeader, { type HeaderViewer } from "./AppHeader";
import { useClub } from "./ClubProvider";
import { AlertsPrompt, useJoinRequests } from "./JoinAlerts";
import type { Feature } from "@/lib/clubSettings";

// the same heavy lettering as the home page and the player of the month poster
const display = Anton({ weight: "400", subsets: ["latin"] });

// Each tool's app-style icon: its tile colour and a line drawing — looks only;
// the list and its order are below.
const TILE: Record<string, { colour: string; icon: React.ReactNode }> = {
  "/admin/stats/matches": { colour: "bg-green-700", icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14M7 10v4M15.5 10h2v4h-2z" /></> },
  "/admin/stats/training": { colour: "bg-cyan-700", icon: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  "/admin/stats/player-of-the-month": { colour: "bg-amber-700", icon: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /> },
  "/admin/awards": { colour: "bg-rose-700", icon: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /> },
  "/admin/training/plans": { colour: "bg-blue-700", icon: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></> },
  "/admin/stats": { colour: "bg-indigo-600", icon: <path d="M5 20V10M12 20V4M19 20v-7" /> },
  "/admin/camera": { colour: "bg-rose-700", icon: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></> },
  "/admin/kit": { colour: "bg-orange-700", icon: <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" /> },
  "/admin/members": { colour: "bg-emerald-700", icon: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M19 8v6M16 11h6" /></> },
  "/admin/settings": { colour: "bg-gray-600", icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></> },
  "/admin/help": { colour: "bg-slate-700", icon: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01" /></> },
};

// The dark paint-stroke banner shared with the home page.
function BrushBackdrop() {
  return (
    <>
      <Image
        src="/poster/brush-background.jpg"
        alt=""
        style={{ filter: "var(--club-brush-filter)" }}
        fill
        priority
        sizes="100vw"
        className="object-cover object-top opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-transparent to-green-950/80" />
    </>
  );
}

// The match log leads: it is where the season's work actually goes in, and
// everything else here reads what it records.
const TOOLS: {
  path: string;
  icon: string;
  title: string;
  body: string;
  badge?: string;
  /** a shorter name for the icon grid */
  short?: string;
  /** The Settings switch that hides this tool when it's off. */
  feature?: Feature;
}[] = [
  {
    path: "/admin/stats/matches",
    icon: "⚽",
    title: "Match Log",
    body: "Fixtures, and each game's goals with who assisted, the awards and who played.",
    badge: "Start Here",
  },
  {
    path: "/admin/stats/training",
    icon: "🏃",
    title: "Training Log",
    body: "Every training session, and who was best trainer.",
  },
  {
    path: "/admin/stats/player-of-the-month",
    icon: "🌟",
    title: "Player of the Month",
    feature: "playerOfMonth",
    body: "Each month's winner from the awards, with a poster to share.",
  },
  {
    path: "/admin/awards",
    icon: "Awards",
    title: "End of Season Awards",
    short: "Awards",
    body: "Parents' ranked votes, award categories and results by team.",
  },
  {
    path: "/admin/training/plans",
    icon: "📝",
    title: "Training Plans",
    feature: "trainingPlans",
    body: "Each team's weeks of themed sessions, built from a shared drill library.",
  },
  {
    path: "/admin/stats",
    icon: "📊",
    title: "Stats Tracker",
    short: "Stats",
    body: "Season totals for every player, added up from the match log.",
  },
  {
    path: "/admin/camera",
    icon: "🎥",
    title: "Camera Register",
    short: "Camera",
    feature: "cameraRegister",
    body: "Home-game filming and cloud uploads.",
  },
  {
    path: "/admin/kit",
    icon: "📋",
    title: "Kit Responses",
    feature: "kitSizes",
    body: "Kit-size submissions by team, with CSV export.",
  },
  {
    path: "/admin/members",
    icon: "👪",
    title: "Members",
    body: "Each team's coaches and players, with their parents; the club code, and approving who can open the hub.",
  },
  {
    path: "/admin/settings",
    icon: "⚙️",
    title: "Settings",
    body: "The club's name, crest, slogan and season, and its teams.",
  },
  {
    path: "/admin/help",
    icon: "❓",
    title: "Help",
    body: "How to use every page, step by step, with screenshots.",
  },
];

export default function AdminHome({
  canResetPassword = false,
  viewer = { signedIn: false, initials: "", photo: null },
  setup = null,
}: {
  canResetPassword?: boolean;
  viewer?: HeaderViewer;
  /** "Set up your club", for a club admin who hasn't finished it */
  setup?: SetupStep[] | null;
}) {
  const CLUB = useClub();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is before showing the password box
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (pwd: string) => {
    if (!pwd) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-auth?key=${encodeURIComponent(pwd)}`);
      if (res.status === 429) {
        setError("Too many wrong passwords — try again in 15 minutes");
        return;
      }
      if (res.status === 403) {
        setError((await res.json().catch(() => ({}))).error ?? "Sign in with your email");
        return;
      }
      if (res.status === 401) {
        setError("Incorrect password");
        return;
      }
      if (!res.ok) throw new Error();
      setAuthed(true);
      // every tool opens with it too, until the app is closed
      rememberCoachKey(pwd);
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // signed in with an account: who as, and whether they're a coach here
  const [account, setAccount] = useState<{ email: string; canCoach: boolean } | null>(null);
  // the club has switched its shared password off: accounts only
  const [passwordOff, setPasswordOff] = useState(false);

  // people waiting to join: a badge on Members, and this phone's alerts
  const { status: joins, refresh: refreshJoins } = useJoinRequests(key, authed);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      setKey(urlKey);
      Promise.resolve(login(urlKey)).finally(() => setChecking(false));
      return;
    }
    // no password in the link: a club admin or coach signed in with their account goes straight in
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (me) => {
        if (me?.passwordSignIn === false) setPasswordOff(true);
        if (me?.user) setAccount({ email: me.user.email, canCoach: !!me.canCoach });
        // an account that can coach, or the coach password given earlier in this session
        const k = me?.canCoach ? SESSION_KEY : await accountKey();
        if (k) {
          setKey(k);
          await login(k);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [login]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!authed) {
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed wp-page relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--club-night)] px-4 py-10">
        <div className="wp-decoration absolute inset-0"><BrushBackdrop /></div>
        <div className="relative w-full max-w-sm">
          <div className="mb-6 text-center text-white">
            <Image
              src={CLUB.crest.src}
              unoptimized
              alt={CLUB.crest.alt}
              width={CLUB.crest.width}
              height={CLUB.crest.height}
              className="mx-auto mb-4 h-24 w-auto"
              priority
            />
            <h1
              className={`${display.className} text-4xl uppercase leading-none tracking-wide drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)]`}
            >
              Coach Admin
            </h1>
            <p className={`${display.className} mt-1 text-lg uppercase tracking-wider text-[var(--club-bright)]`}>
              {CLUB.fullName}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-7 shadow-2xl dark:bg-[#1c1c1e]">
            <NoTabBar />
            <p className="mb-4 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">🔒 Coaches only</p>
            {account && !account.canCoach && (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                You&apos;re signed in as {account.email}, but you&apos;re not a coach at this club. A club admin can
                give you the Coach role in Members.
              </p>
            )}
            {!account && (
              <>
                <Link
                  href="/signin?next=/admin"
                  className="mb-3 block w-full rounded-xl bg-green-600 py-3 text-center font-bold text-white hover:bg-green-700"
                >
                  Sign In With Your Email
                </Link>
                {!passwordOff && <p className="mb-3 text-center text-xs text-gray-400">or use the coach password</p>}
              </>
            )}
            {passwordOff ? (
              error && <p className="text-sm text-red-600 mb-3 text-center dark:text-red-400">{error}</p>
            ) : (
              <>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login(key)}
              placeholder="Enter admin password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3 dark:text-gray-50 dark:border-white/15"
            />
            {error && <p className="text-sm text-red-600 mb-3 text-center dark:text-red-400">{error}</p>}
            <button
              onClick={() => login(key)}
              disabled={loading || !key}
              className="w-full rounded-xl bg-gray-900 py-3 font-bold text-white hover:bg-black disabled:opacity-40 cursor-pointer dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
              </>
            )}
            {canResetPassword && !passwordOff && (
              <Link
                href="/reset-password"
                className="mt-4 block text-center text-sm font-semibold text-green-700 hover:text-green-800 dark:text-green-400"
              >
                Forgot the password?
              </Link>
            )}
            <Link
              href="/" onClick={backOr}
              className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400"
            >
              ← Back to Team Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // an account needs no password in its links
  const suffix = keyQuery(key);
  const tools = TOOLS.filter((tool) => !tool.feature || CLUB.features[tool.feature]);

  // laid out like an app: a large title, then the tools as a grid of icons
  return (
    <div className="themed wp-page relative isolate min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* header: your photo (Your Account), Search, the club's crest — as on Home */}
        <AppHeader viewer={viewer} crest={CLUB.crest} />
        <div>
          <h1 className="wp-text text-[34px] font-extrabold leading-tight tracking-tight">Coach Admin</h1>
          <p className="wp-text mt-0.5 truncate text-[15px] text-gray-500 dark:text-gray-400">{CLUB.fullName}</p>
        </div>

        {setup && <SetupCard steps={setup} />}

        {account?.canCoach && key === SESSION_KEY && <AlertsPrompt status={joins} refresh={refreshJoins} />}

        <div className="rounded-3xl bg-white px-2 pb-3 pt-5 shadow-sm dark:bg-[#1c1c1e]">
          <div className="grid grid-cols-3 gap-x-1 gap-y-5">
            {tools.map((tool) => {
              const tile = TILE[tool.path];
              const badge = tool.path === "/admin/members" && !!joins?.pending ? joins.pending : 0;
              return (
                <Link
                  key={tool.path}
                  href={`${tool.path}${suffix}`}
                  className="press relative flex flex-col items-center gap-2 text-center text-[12.5px] font-semibold leading-tight"
                >
                  <span className={`grid h-[60px] w-[60px] place-items-center rounded-[18px] text-white shadow-sm ${tile?.colour ?? "bg-green-700"}`}>
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {tile?.icon}
                    </svg>
                  </span>
                  {tool.short ?? tool.title}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 left-1/2 ml-5 min-w-[1.4rem] rounded-full bg-red-500 px-1.5 text-center text-xs font-bold leading-[1.4rem] text-white ring-2 ring-white dark:ring-[#1c1c1e]">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {account && key === SESSION_KEY && (
          <p className="wp-text text-center text-xs text-gray-500 dark:text-gray-400">
            Signed in as {account.email} ·{" "}
            <Link href="/account" className="font-semibold text-green-700 hover:underline dark:text-green-400">Your account</Link>
          </p>
        )}
      </main>
    </div>
  );
}
