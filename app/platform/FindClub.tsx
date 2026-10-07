"use client";

// Join your club: type the club code your coach gave you. Clubs aren't listed
// or searchable, so only people a club gives its code (or link) can find it.
import { useState } from "react";

const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function FindClub() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (clean(code).length !== 6) return setError("Club codes have 6 letters and numbers, like K7Q-M3X.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs?code=${encodeURIComponent(clean(code))}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go}>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K7Q-M3X"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Your club code"
          className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3.5 font-mono text-lg uppercase tracking-widest text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          disabled={busy || !clean(code)}
          className="shrink-0 rounded-2xl bg-green-600 px-5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "…" : "Join"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
