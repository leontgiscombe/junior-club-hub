"use client";

// The ground box on "When and where?": typing searches as you go — grounds
// this club has played at before first, then places found by address search
// (/api/places) — and picking one fills in the ground and its address. What's
// typed can always just be kept as it is.
import { useEffect, useRef, useState } from "react";

type Place = { name: string; address: string; used?: boolean };

export default function GroundSearch({
  venue,
  known,
  className,
  onType,
  onPick,
}: {
  venue: string;
  /** grounds played at before, for this team first */
  known: { venue: string; address: string }[];
  className: string;
  onType: (venue: string) => void;
  onPick: (place: { venue: string; address: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const q = venue.trim();

  // search after a short pause in typing, and drop answers to older searches
  useEffect(() => {
    if (!open || q.length < 3) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json().catch(() => ({}))) as { places?: Place[]; error?: string };
        setFound(data.places ?? []);
        setError(res.ok ? "" : (data.error ?? "Address search isn't answering"));
      } catch {
        if (!ctrl.signal.aborted) setError("Address search isn't answering");
      }
      if (!ctrl.signal.aborted) setSearching(false);
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [q, open]);

  // a tap anywhere else closes the list
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const used: Place[] = known
    .filter((k) => !words.length || words.every((w) => `${k.venue} ${k.address}`.toLowerCase().includes(w)))
    .slice(0, 4)
    .map((k) => ({ name: k.venue, address: k.address, used: true }));
  const fresh = q.length >= 3 ? found.filter((f) => !used.some((u) => u.address.toLowerCase() === f.address.toLowerCase())) : [];
  const list = [...used, ...fresh];

  function pick(p: Place) {
    onPick({ venue: p.name || p.address.split(",")[0], address: p.address });
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={venue}
          onChange={(e) => {
            onType(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && open && list[0]) {
              e.preventDefault();
              pick(list[0]);
            }
          }}
          placeholder="Search for the ground or postcode"
          className={`${className} pl-11`}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open && list.length > 0}
          aria-controls="ground-results"
        />
        {searching && <span className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" aria-hidden="true" />}
      </div>

      {open && (list.length > 0 || error || (q.length >= 3 && !searching)) && (
        <ul id="ground-results" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-2xl bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-[#2c2c2e] dark:ring-white/10">
          {list.map((p, i) => (
            <li key={`${p.name}|${p.address}|${i}`} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(p)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${p.used ? "bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {p.used ? <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5" /> : <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>}
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.name || p.address.split(",")[0]}</span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {p.used ? "Played here before · " : ""}
                    {p.address}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {error && <li className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{error}</li>}
          {!error && q.length >= 3 && !searching && list.length === 0 && (
            <li className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">Nothing found — keep what you&apos;ve typed and add the address below.</li>
          )}
        </ul>
      )}
    </div>
  );
}
