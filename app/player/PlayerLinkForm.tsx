"use client";

import { useState } from "react";

export default function PlayerLinkForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/player/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work — try again");
      window.location.href = "/training-hub";
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work — try again");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Ask your parent or coach to open your card in the club&apos;s app and tap <strong>Set Up a Device</strong>. Then type
        the code here.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        aria-label="Six-digit code"
        className="rounded-xl border border-gray-200 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
      />
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
      <button disabled={busy || code.length !== 6} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Setting up…" : "Set Up This Device"}
      </button>
      <p className="text-center text-xs text-gray-400">This device will open the Training Hub as you. A grown-up can remove it any time.</p>
    </form>
  );
}
