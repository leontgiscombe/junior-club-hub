"use client";

// Setting up a player's own device: scan the QR code on a grown-up's phone, or
// type the six-digit code if there's no camera (or it isn't working). A code in
// the address (from scanning with the phone's own camera) is used straight away.
import { useCallback, useEffect, useState } from "react";
import QrScanner from "../components/QrScanner";
import { readPlayerCode } from "@/lib/playerCode";

export default function PlayerLinkForm({ initialCode = "", root }: { initialCode?: string; root: string }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const link = useCallback(async (c: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/player/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work — try again");
      window.location.href = "/training-hub";
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work — try again");
      setBusy(false);
    }
  }, []);

  // opened from the QR code with the phone's own camera: set up straight away
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialCode.replace(/\D/g, "").length === 6) link(initialCode.replace(/\D/g, ""));
  }, [initialCode, link]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const scanned = useCallback(
    (text: string) => {
      setScanning(false);
      const found = readPlayerCode(text, window.location.host, root);
      if (!found) return setError("That QR code isn't a player code from the club's app.");
      // another club's code: its own setup page
      if (found.url && new URL(found.url).host !== window.location.host) {
        window.location.href = found.url;
        return;
      }
      setCode(found.code);
      link(found.code);
    },
    [link, root],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Ask your parent or coach to open your card in the club&apos;s app and tap <strong>Set Up a Device</strong>.
      </p>
      <button
        type="button"
        onClick={() => setScanning(true)}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
        </svg>
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
          link(code);
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
          className="rounded-xl border border-gray-200 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
        />
        <button
          disabled={busy || code.length !== 6}
          className="rounded-xl border border-green-600 py-3 font-bold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-400/10"
        >
          {busy ? "Setting up…" : "Set Up This Device"}
        </button>
      </form>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
      <p className="text-center text-xs text-gray-400">This device will open the Training Hub as you. A grown-up can remove it any time.</p>
      {scanning && <QrScanner onResult={scanned} onClose={() => setScanning(false)} />}
    </div>
  );
}
