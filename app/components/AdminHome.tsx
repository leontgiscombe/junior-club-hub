"use client";

import Link from "next/link";
import Image from "next/image";
import { Anton } from "next/font/google";
import { useEffect, useState, useCallback } from "react";
import { SESSION_KEY } from "@/lib/access";
import { useClub } from "./ClubProvider";
import type { Feature } from "@/lib/clubSettings";

// the same heavy lettering as the home page and the player of the month poster
const display = Anton({ weight: "400", subsets: ["latin"] });

// Each tool's icon tile colour — looks only; the list and its order are below.
const TILE: Record<string, string> = {
  "/admin/stats/matches": "from-green-700 to-green-500",
  "/admin/stats/training": "from-teal-600 to-cyan-500",
  "/admin/stats/player-of-the-month": "from-amber-500 to-yellow-400",
  "/admin/training/plans": "from-blue-600 to-sky-500",
  "/admin/stats": "from-indigo-600 to-violet-500",
  "/admin/camera": "from-rose-600 to-pink-500",
  "/admin/kit": "from-orange-600 to-amber-500",
  "/admin/players": "from-lime-600 to-green-500",
  "/admin/members": "from-emerald-600 to-teal-500",
  "/admin/settings": "from-gray-700 to-gray-500",
  "/admin/help": "from-slate-600 to-slate-500",
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
    body: "Every Monday's session, and who was best trainer.",
  },
  {
    path: "/admin/stats/player-of-the-month",
    icon: "🌟",
    title: "Player of the Month",
    feature: "playerOfMonth",
    body: "Each month's winner from the awards, with a poster to share.",
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
    body: "Season totals for every player, added up from the match log.",
  },
  {
    path: "/admin/camera",
    icon: "🎥",
    title: "Camera Register",
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
    path: "/admin/players",
    icon: "🧒",
    title: "Players",
    body: "The club's squad, and which team each player is in.",
  },
  {
    path: "/admin/members",
    icon: "👪",
    title: "Members",
    body: "The club code for parents, and approving who can open the hub.",
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

export default function AdminHome({ canResetPassword = false }: { canResetPassword?: boolean }) {
  const CLUB = useClub();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
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
      if (res.status === 401) {
        setError("Incorrect password");
        return;
      }
      if (!res.ok) throw new Error();
      setAuthed(true);
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // signed in with an account: who as, and whether they're a coach here
  const [account, setAccount] = useState<{ email: string; canCoach: boolean } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      setKey(urlKey);
      login(urlKey);
      return;
    }
    // no password in the link: a club admin or coach signed in with their account goes straight in
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((me) => {
        if (!me?.user) return;
        setAccount({ email: me.user.email, canCoach: !!me.canCoach });
        if (me.canCoach) {
          setKey(SESSION_KEY);
          login(SESSION_KEY);
        }
      })
      .catch(() => {});
  }, [login]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!authed) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--club-night)] px-4 py-10">
        <BrushBackdrop />
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
          <div className="rounded-3xl bg-white p-7 shadow-2xl">
            <p className="mb-4 text-center text-sm font-semibold text-gray-500">🔒 Coaches only</p>
            {account && !account.canCoach && (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
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
                <p className="mb-3 text-center text-xs text-gray-400">or use the coach password</p>
              </>
            )}
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login(key)}
              placeholder="Enter admin password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3"
            />
            {error && <p className="text-sm text-red-600 mb-3 text-center">{error}</p>}
            <button
              onClick={() => login(key)}
              disabled={loading || !key}
              className="w-full rounded-xl bg-gray-900 py-3 font-bold text-white hover:bg-black disabled:opacity-40 cursor-pointer"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            {canResetPassword && (
              <Link
                href="/reset-password"
                className="mt-4 block text-center text-sm font-semibold text-green-700 hover:text-green-800"
              >
                Forgot the password?
              </Link>
            )}
            <Link
              href="/"
              className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700"
            >
              ← Back to Team Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const suffix = `?key=${encodeURIComponent(key)}`;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="relative overflow-hidden bg-[var(--club-night)] px-6 pb-14 pt-8 text-center text-white">
        <BrushBackdrop />
        <div className="relative">
          <div className="mx-auto w-full max-w-2xl text-left">
            <Link href="/" className="text-sm font-medium text-green-100 hover:text-white">
              ← Team Hub
            </Link>
          </div>
          <Image
            src={CLUB.crest.src}
            unoptimized
            alt={CLUB.crest.alt}
            width={CLUB.crest.width}
            height={CLUB.crest.height}
            className="mx-auto mt-3 h-20 w-auto"
            priority
          />
          <h1
            className={`${display.className} mt-3 text-4xl uppercase leading-none tracking-wide drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)] sm:text-5xl`}
          >
            Coach Admin
          </h1>
          <p className={`${display.className} mt-1 text-lg uppercase tracking-wider text-[var(--club-bright)]`}>
            {CLUB.fullName}
          </p>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 w-full max-w-2xl flex-1 px-5 pb-10">
        <p className="mx-auto mb-4 w-fit rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 shadow-sm">
          Choose a tool
        </p>
        {account && key === SESSION_KEY && (
          <p className="mb-4 text-center text-xs text-gray-500">
            Signed in as {account.email} ·{" "}
            <Link href="/account" className="font-semibold text-green-700 hover:underline">Your account</Link>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.filter((tool) => !tool.feature || CLUB.features[tool.feature]).map((tool) => (
            <Link
              key={tool.path}
              href={`${tool.path}${suffix}`}
              className="group flex flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <span className="mb-3 flex items-center gap-3">
                <span
                  className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-3xl shadow-sm ${
                    TILE[tool.path] ?? "from-green-700 to-green-500"
                  }`}
                >
                  {tool.icon}
                </span>
                {tool.badge && (
                  <span className="rounded-full bg-[var(--club-bright)] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[var(--club-night)]">
                    {tool.badge}
                  </span>
                )}
              </span>
              <h2 className="text-lg font-extrabold text-gray-900">{tool.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-500">{tool.body}</p>
              <span className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 transition-colors group-hover:bg-gray-900 group-hover:text-white">
                Open
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </main>

      <footer className="bg-[var(--club-night)] px-6 py-8 text-center">
        <p className={`${display.className} text-lg uppercase tracking-wide text-[var(--club-bright)]`}>
          {CLUB.slogan}
        </p>
        <p className="mt-2 text-sm text-gray-400">{CLUB.fullName}</p>
      </footer>
    </div>
  );
}
