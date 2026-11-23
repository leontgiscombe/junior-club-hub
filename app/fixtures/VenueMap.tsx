"use client";

// Where a game is: an Apple map of the address (MapKit JS, with a token from
// /api/mapkit), and buttons that open it — or directions to it — in Apple Maps.
// Without MapKit set up, or if the address can't be found, the card keeps
// the address and the buttons and simply has no map.
import { useEffect, useRef, useState } from "react";
import { appleDirectionsUrl, appleMapsUrl } from "@/lib/fixtureFormat";
import { loadMapKit } from "@/lib/mapkit";

/** `el` once it has a width and height on the page (null if it never does). */
function hasSize(el: HTMLElement): Promise<HTMLElement | null> {
  const sized = () => el.isConnected && el.clientWidth > 0 && el.clientHeight > 0;
  if (sized()) return Promise.resolve(el);
  return new Promise((resolve) => {
    const watch = new ResizeObserver(() => {
      if (!sized()) return;
      watch.disconnect();
      window.clearTimeout(timer);
      resolve(el);
    });
    const timer = window.setTimeout(() => {
      watch.disconnect();
      resolve(null);
    }, 8000);
    watch.observe(el);
  });
}

export default function VenueMap({ venue, address, label }: { venue: string; address: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "map" | "none">("loading");
  const query = [venue, address].filter(Boolean).join(", ");

  useEffect(() => {
    let map: { destroy: () => void } | null = null;
    let gone = false;
    (async () => {
      const mk = await loadMapKit();
      if (gone) return;
      if (!mk || !box.current) return setState("none");
      const where = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        new mk.Geocoder({ language: "en-GB" }).lookup(address || venue, (err, data) => {
          const c = data?.results?.[0]?.coordinate as { latitude?: number; longitude?: number } | undefined;
          // only a real place: Apple's map can't draw round a missing or broken one
          resolve(!err && c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) ? (c as { latitude: number; longitude: number }) : null);
        });
      });
      if (gone) return;
      if (!where) return setState("none");
      // drawn only once its box has a size: one still sliding in (or just taken away) has none, and MapKit fails on that
      const el = await hasSize(box.current);
      if (gone) return;
      if (!el) return setState("none");
      try {
        const dark = document.documentElement.classList.contains("dark");
        const centre = new mk.Coordinate(where.latitude, where.longitude);
        const m = new mk.Map(el, {
          region: new mk.CoordinateRegion(centre, new mk.CoordinateSpan(0.008, 0.008)),
          colorScheme: dark ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light,
          showsCompass: mk.FeatureVisibility.Hidden,
          showsZoomControl: false,
          showsMapTypeControl: false,
          isRotationEnabled: false,
        });
        m.addAnnotation(new mk.MarkerAnnotation(centre, { color: "#15803d", title: venue || label, glyphText: "⚽" }));
        map = m;
        setState("map");
      } catch {
        setState("none");
      }
    })();
    return () => {
      gone = true;
      try {
        map?.destroy();
      } catch {}
      map = null;
    };
  }, [address, venue, label]);

  return (
    <div>
      {state !== "none" && (
        <div className="relative h-44 overflow-hidden bg-gray-100 dark:bg-white/5">
          <div ref={box} className="absolute inset-0" />
          {state === "loading" && <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-white/5" />}
        </div>
      )}
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
            <circle cx="12" cy="10" r="2.3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          {venue && <span className="block font-bold">{venue}</span>}
          {address && <span className="block whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{address}</span>}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <a href={appleMapsUrl(query)} target="_blank" rel="noopener" className="press rounded-2xl bg-gray-100 py-2.5 text-center text-sm font-bold text-gray-900 dark:bg-white/10 dark:text-gray-50">
          Open in Maps
        </a>
        <a href={appleDirectionsUrl(query)} target="_blank" rel="noopener" className="press rounded-2xl bg-green-700 py-2.5 text-center text-sm font-bold text-white">
          Directions
        </a>
      </div>
    </div>
  );
}
