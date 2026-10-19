"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import QrScanner from "../../components/QrScanner";
import { readPlayerCode } from "@/lib/playerCode";

type Club = { name: string; home: string };
const REMEMBER = "gch_start_club";

// the club picked here last time, kept on this device only. The snapshot is the raw string, so it stays stable between renders.
const readStored = () => {
  try {
    return localStorage.getItem(REMEMBER);
  } catch {
    return null;
  }
};
const parseClub = (raw: string | null): Club | null => {
  try {
    const c = JSON.parse(raw ?? "null") as Club | null;
    return c && typeof c.home === "string" && /^https?:\/\//.test(c.home) ? c : null;
  } catch {
    return null;
  }
};
const remember = (c: Club) => {
  try {
    localStorage.setItem(REMEMBER, JSON.stringify(c));
  } catch {}
};
const noop = () => () => {};

export default function StartScreen({
  platform,
  root,
  clubs,
  appView,
}: {
  platform: string;
  root: string;
  // the signed-in account's clubs (null when signed out)
  clubs: Club[] | null;
  // inside the App Store app: no sign-up (lib/inApp.ts)
  appView: boolean;
}) {
  const remembered = parseClub(useSyncExternalStore(noop, readStored, () => null));
  const [forget, setForget] = useState(false);
  const [step, setStep] = useState<"choose" | "player" | "grownup">("choose");
  const [found, setFound] = useState<(Club & { join: string }) | null>(null);
  const [code, setCode] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the app opens straight onto the club picked last time (?pick shows this screen instead)
  const rememberedHome = remembered?.home;
  useEffect(() => {
    if (appView && rememberedHome && !new URLSearchParams(window.location.search).has("pick")) {
      window.location.replace(rememberedHome);
    }
  }, [appView, rememberedHome]);

  const playerCode = useCallback(async (c: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/player/find?code=${encodeURIComponent(c)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That code isn't right");
      remember({ name: data.name, home: data.home });
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
      setBusy(false);
    }
  }, []);

  const scanned = useCallback(
    (text: string) => {
      setScanning(false);
      const r = readPlayerCode(text, window.location.host, root);
      if (!r) return setError("That QR code isn't a player code from the club's app.");
      // the club's own setup link: go straight there
      if (r.url) {
        remember({ name: "", home: new URL(r.url).origin + "/" });
        window.location.href = r.url;
        return;
      }
      setCode(r.code);
      playerCode(r.code);
    },
    [playerCode, root],
  );

  async function findClub(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clean = clubCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const res = await fetch(`/api/clubs?code=${encodeURIComponent(clean)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That code isn't right");
      remember({ name: data.name, home: data.home });
      setFound({ name: data.name, home: data.home, join: data.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  const card = "w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl dark:bg-[#1c1c1e]";
  const big = "flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left font-bold";
  const back = (
    <button
      onClick={() => {
        setStep("choose");
        setError(null);
        setFound(null);
      }}
      className="mt-4 w-full text-center text-sm font-semibold text-gray-500 dark:text-gray-400"
    >
      Back
    </button>
  );
  const codeBox =
    "w-full rounded-xl border border-gray-200 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";
  const showRemembered = remembered && !forget && !clubs?.length;

  return (
    <div className={card}>
      <div className="mb-6 text-center">
        <div className="text-4xl">⚽</div>
        <h1 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-gray-50">
          {step === "player" ? "I'm a Player" : step === "grownup" ? "Find Your Club" : "Welcome"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{platform}</p>
      </div>

      {step === "choose" && (
        <div className="flex flex-col gap-3">
          {showRemembered && (
            <>
              <a href={remembered.home} className={`${big} justify-center bg-green-600 text-white hover:bg-green-700`}>
                Continue{remembered.name ? ` to ${remembered.name}` : ""}
              </a>
              <button onClick={() => setForget(true)} className="mb-2 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                A different club
              </button>
            </>
          )}
          {clubs && clubs.length > 0 && (
            <div className="mb-2 flex flex-col gap-2">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Your Clubs</p>
              {clubs.map((c) => (
                <a
                  key={c.home}
                  href={c.home}
                  onClick={() => remember(c)}
                  className={`${big} justify-center bg-green-600 text-white hover:bg-green-700`}
                >
                  {c.name}
                </a>
              ))}
            </div>
          )}
          <button onClick={() => setStep("player")} className={`${big} bg-green-50 text-green-900 dark:bg-green-400/10 dark:text-green-200`}>
            <span className="text-3xl">🏃</span>
            <span>
              I&apos;m a Player
              <span className="block text-sm font-medium opacity-80">With a code from my parent or coach</span>
            </span>
          </button>
          <button onClick={() => setStep("grownup")} className={`${big} bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-50`}>
            <span className="text-3xl">👋</span>
            <span>
              I&apos;m a Parent or Coach
              <span className="block text-sm font-medium opacity-80">With our club&apos;s code</span>
            </span>
          </button>
          {!clubs && (
            <a href="/signin?next=/start" className="mt-1 rounded-xl border border-green-600 py-3 text-center font-bold text-green-700 dark:text-green-400">
              Already have an account? Sign In
            </a>
          )}
          <a href="/signup" className={`${big} bg-white text-gray-900 ring-1 ring-black/10 dark:bg-white/5 dark:text-gray-50 dark:ring-white/15`}>
            <span className="text-3xl">🏟️</span>
            <span>
              Start a New Club
              <span className="block text-sm font-medium opacity-80">Your club&apos;s own hub, 30 days free</span>
            </span>
          </a>
        </div>
      )}

      {step === "player" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Ask your parent or coach to open your card in the club&apos;s app and tap <strong>Set Up a Device</strong>.
          </p>
          <button onClick={() => setScanning(true)} disabled={busy} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
            Scan the QR Code
          </button>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
            or type the code
            <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              playerCode(code);
            }}
            className="flex flex-col gap-3"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              aria-label="Six-digit code"
              className={codeBox}
            />
            <button disabled={busy || code.length !== 6} className="rounded-xl border border-green-600 py-3 font-bold text-green-700 disabled:opacity-50 dark:text-green-400">
              {busy ? "Finding your club…" : "Next"}
            </button>
          </form>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
          {back}
        </div>
      )}

      {step === "grownup" && (
        <div className="flex flex-col gap-3">
          {found ? (
            <>
              <p className="text-center text-sm text-gray-600 dark:text-gray-300">
                Found <strong>{found.name || "your club"}</strong>.
              </p>
              <a href={`${found.home}signin?next=/`} className="rounded-xl bg-green-600 py-3.5 text-center font-bold text-white hover:bg-green-700">
                Sign In
              </a>
              <a href={found.join} className="rounded-xl border border-green-600 py-3 text-center font-bold text-green-700 dark:text-green-400">
                New Here? Join the Club
              </a>
            </>
          ) : (
            <form onSubmit={findClub} className="flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">Type the club code your coach gave you.</p>
              <input
                value={clubCode}
                onChange={(e) => setClubCode(e.target.value)}
                placeholder="K7Q-M3X"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label="Your club code"
                className={`${codeBox} uppercase`}
              />
              <button disabled={busy || clubCode.replace(/[^A-Za-z0-9]/g, "").length !== 6} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? "Finding…" : "Find My Club"}
              </button>
            </form>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
          {back}
        </div>
      )}

      {scanning && <QrScanner onResult={scanned} onClose={() => setScanning(false)} />}
    </div>
  );
}
