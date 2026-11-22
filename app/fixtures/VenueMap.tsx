"use client";

// Where a game is: an Apple map of the address (MapKit JS, with a token from
// /api/mapkit), and buttons that open it — or directions to it — in Apple Maps.
// Without MapKit set up, or if the address can't be found, the card keeps
// the address and the buttons and simply has no map.
import { useEffect, useRef, useState } from "react";
import { appleDirectionsUrl, appleMapsUrl } from "@/lib/fixtureFormat";

type MapKit = {
  loadedLibraries?: string[];
  init: (o: { authorizationCallback: (done: (token: string) => void) => void; language?: string }) => void;
  Geocoder: new (o?: { language?: string }) => {
    lookup: (q: string, cb: (err: unknown, data: { results: { coordinate: unknown }[] }) => void) => void;
  };
  Map: (new (el: HTMLElement, o: Record<string, unknown>) => {
    region: unknown;
    addAnnotation: (a: unknown) => void;
    destroy: () => void;
  }) & { ColorSchemes: { Light: string; Dark: string } };
  CoordinateRegion: new (c: unknown, s: unknown) => unknown;
  CoordinateSpan: new (a: number, b: number) => unknown;
  MarkerAnnotation: new (c: unknown, o: Record<string, unknown>) => unknown;
  FeatureVisibility: { Hidden: string };
};

let loading: Promise<MapKit | null> | null = null;

/** Apple's MapKit JS, loaded and signed in once per page. */
function loadMapKit(): Promise<MapKit | null> {
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch("/api/mapkit", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    const { token } = (await res.json()) as { token: string };
    const w = window as unknown as { mapkit?: MapKit };
    if (!w.mapkit) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
        s.crossOrigin = "anonymous";
        s.dataset.libraries = "map,annotations,services";
        s.dataset.callback = "__hubMapKitReady";
        (window as unknown as Record<string, () => void>).__hubMapKitReady = () => resolve();
        s.onerror = () => reject(new Error("MapKit didn't load"));
        document.head.appendChild(s);
      });
    }
    const mk = w.mapkit!;
    mk.init({ authorizationCallback: (done) => done(token), language: "en-GB" });
    return mk;
  })().catch(() => null);
  return loading;
}

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
