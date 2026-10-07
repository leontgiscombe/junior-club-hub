"use client";

// Go to your club: type its web address, as the club shared it. Clubs aren't
// listed or searchable, so only people the club gives its link to find it.
import { useState } from "react";

const toAddress = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[./]/)[0]
    .replace(/[^a-z0-9-]/g, "");

export default function FindClub({ rootDomain }: { rootDomain: string }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const a = toAddress(address);
    if (!a) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs?address=${encodeURIComponent(a)}`);
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
        <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-green-400">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="your-club"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Your club's web address"
            className="min-w-0 flex-1 rounded-l-2xl px-4 py-3.5 text-gray-900 focus:outline-none"
          />
          <span className="hidden shrink-0 pr-4 text-sm text-gray-400 sm:inline">.{rootDomain}</span>
        </div>
        <button
          disabled={busy || !toAddress(address)}
          className="shrink-0 rounded-2xl bg-green-600 px-5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "…" : "Go"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
