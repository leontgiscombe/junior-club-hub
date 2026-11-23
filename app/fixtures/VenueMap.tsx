"use client";

// Where a game is: an Apple map of the address (MapKit JS, with a token from
// /api/mapkit), and buttons that open it — or directions to it — in Apple Maps.
// Without MapKit set up, or if the address can't be found, the card keeps
// the address and the buttons and simply has no map.
import { useEffect, useRef, useState } from "react";
import { appleDirectionsUrl, appleMapsUrl } from "@/lib/fixtureFormat";
import { loadMapKit } from "@/lib/mapkit";

export default function VenueMap({ venue, address, label }: { venue: string; address: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "map" | "none">("loading");
  const query = [venue, address].filter(Boolean).join(", ");

  useEffect(() => {
    let map: { destroy: () => void } | null = null;
    let gone = false;
    loadMapKit().then((mk) => {
      if (gone) return;
      if (!mk || !box.current) return setState("none");
      new mk.Geocoder({ language: "en-GB" }).lookup(address || venue, (err, data) => {
        const where = data?.results?.[0]?.coordinate;
        if (gone || err || !where || !box.current) return setState("none");
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches || document.documentElement.dataset.theme === "dark";
        const m = new mk.Map(box.current, {
          colorScheme: dark ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light,
          showsCompass: mk.FeatureVisibility.Hidden,
          showsZoomControl: false,
          showsMapTypeControl: false,
          isRotationEnabled: false,
        });
        m.region = new mk.CoordinateRegion(where, new mk.CoordinateSpan(0.008, 0.008));
        m.addAnnotation(new mk.MarkerAnnotation(where, { color: "#15803d", title: venue || label, glyphText: "⚽" }));
        map = m;
        setState("map");
      });
    });
    return () => {
      gone = true;
      map?.destroy();
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
