"use client";

// The ground box on "When and where?": typing searches as you go — grounds
// this club has played at before first, then places from Apple Maps (MapKit
// JS search, the same as the map on a game's page), and picking one fills in
// the ground and its full address. Apple's search leans towards where the
// club's grounds are. If MapKit isn't set up on the hub, or Apple doesn't
// answer, the free OpenStreetMap search (/api/places) is used instead. What's
// typed can always just be kept as it is.
import { useEffect, useRef, useState } from "react";
import { loadMapKit, type AppleSuggestion, type MapKit } from "@/lib/mapkit";

type Place = { name: string; address: string; used?: boolean; apple?: AppleSuggestion };
type AppleSearch = InstanceType<MapKit["Search"]>;

/** Apple's search, set up once per page: leaning towards the club's own area when a past ground can be found. */
let appleSearch: Promise<AppleSearch | null> | null = null;
function getAppleSearch(near: string): Promise<AppleSearch | null> {
  appleSearch ??= loadMapKit().then(async (mk) => {
    if (!mk) return null;
    try {
      // the UK, unless a ground the club has used puts the search nearer home
      let centre = new mk.Coordinate(54.3, -2.4);
      let span = new mk.CoordinateSpan(10, 12);
      if (near) {
        const found = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
          new mk.Geocoder({ language: "en-GB" }).lookup(near, (err, data) => resolve(err ? null : ((data?.results?.[0]?.coordinate as { latitude: number; longitude: number }) ?? null)));
          window.setTimeout(() => resolve(null), 4000);
        });
        if (found) {
          centre = new mk.Coordinate(found.latitude, found.longitude);
          span = new mk.CoordinateSpan(0.8, 0.8);
        }
      }
      return new mk.Search({
        language: "en-GB",
        getsUserLocation: false,
        region: new mk.CoordinateRegion(centre, span),
        limitToCountries: "GB",
        includeQueries: false,
      });
    } catch {
      return null;
    }
  });
  return appleSearch;
}

/** Apple's suggestions for what's typed. */
function appleSuggest(search: AppleSearch, q: string): Promise<Place[]> {
  return new Promise((resolve, reject) => {
    search.autocomplete(q, (err, data) => {
      if (err) return reject(err);
      resolve(
        (data?.results ?? [])
          .filter((r) => r.displayLines?.length)
          .slice(0, 6)
          .map((r) => ({ name: r.displayLines[0], address: r.displayLines.slice(1).join(", "), apple: r })),
      );
    });
  });
}

/** A suggestion picked: the place's name and full address (with the postcode), from Apple. */
function appleResolve(search: AppleSearch, s: AppleSuggestion): Promise<{ venue: string; address: string } | null> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 5000);
    search.search(s, (err, data) => {
      const place = !err ? data?.places?.[0] : undefined;
      if (!place?.formattedAddress) return resolve(null);
      const name = place.name ?? s.displayLines[0];
      // an address found by its street has the street as its name: no ground name to add
      // without the country on the end: every ground's in the UK
      const full = place.formattedAddress.replace(/\n/g, ", ").replace(/,\s*(England|Scotland|Wales|Northern Ireland|United Kingdom|UK)$/i, "");
      // Apple starts a place's address with its name: the name already has its own box
      const address = full.toLowerCase().startsWith(`${name.toLowerCase()}, `) ? full.slice(name.length + 2) : full;
      resolve({ venue: name, address });
    });
  });
}

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
  const near = known.find((k) => k.address)?.address ?? "";

  // search after a short pause in typing, and drop answers to older searches
  useEffect(() => {
    if (!open || q.length < 3) return;
    let stale = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      let places: Place[] = [];
      let problem = "";
      const apple = await getAppleSearch(near);
      try {
        if (!apple) throw new Error("no Apple search");
        places = await appleSuggest(apple, q);
      } catch {
        // Apple isn't set up or didn't answer: the OpenStreetMap search instead
        try {
          const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
          const data = (await res.json().catch(() => ({}))) as { places?: Place[]; error?: string };
          places = data.places ?? [];
          if (!res.ok) problem = data.error ?? "Address search isn't answering";
        } catch {
          problem = "Address search isn't answering";
        }
      }
      if (stale) return;
      setFound(places);
      setError(problem);
      setSearching(false);
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [q, open, near]);

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
  const fresh = q.length >= 3 ? found.filter((f) => !used.some((u) => u.name.toLowerCase() === f.name.toLowerCase())) : [];
  const list = [...used, ...fresh];

  async function pick(p: Place) {
    setOpen(false);
    // fill in what's shown straight away, then Apple's full address once it's found
    onPick({ venue: p.name || p.address.split(",")[0], address: p.address });
    if (p.apple) {
      const apple = await getAppleSearch(near);
      const full = apple ? await appleResolve(apple, p.apple) : null;
      if (full) onPick(full);
    }
  }

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          // type="search" would give iPhone's own clear button, and its delete key's quirks; plain text keeps it simple
          type="text"
          value={venue}
          onChange={(e) => {
            onType(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            // get Apple's search ready while they type
            void getAppleSearch(near);
          }}
          onKeyDown={(e) => {
            // nothing typed here should ever reach the page (going back, submitting)
            e.stopPropagation();
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && list[0]) pick(list[0]);
            }
          }}
          placeholder="Search for the ground or address"
          className={`${className} pl-11 pr-11`}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open && list.length > 0}
          aria-controls="ground-results"
        />
        {searching ? (
          <span className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" aria-hidden="true" />
        ) : (
          venue && (
            // clear it with one tap, rather than holding delete
            <button
              type="button"
              aria-label="Clear the ground"
              onClick={() => {
                onType("");
                setOpen(true);
              }}
              className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-gray-200 text-gray-600 dark:bg-white/15 dark:text-gray-300"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
            </button>
          )
        )}
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
