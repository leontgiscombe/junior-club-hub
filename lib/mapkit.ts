// Apple's MapKit JS in the browser: the map on a game's page
// (app/fixtures/VenueMap.tsx) and the ground search when setting a game up
// (app/admin/fixtures/GroundSearch.tsx). Loaded once per page, signed in
// with a short-lived token from /api/mapkit; null when MapKit isn't set up
// on the hub, or Apple doesn't answer. Browser-only.

type Coordinate = { latitude: number; longitude: number };

/** A suggestion as the ground is typed: Apple's lines, e.g. ["Woodhall Sports Hub", "Woodhall Road, Calverley"]. */
export type AppleSuggestion = { displayLines: string[]; coordinate?: Coordinate };
/** A place Apple has found: its name and full address. */
export type ApplePlace = { name?: string; formattedAddress?: string; coordinate?: Coordinate };

type Search = {
  autocomplete: (q: string, cb: (err: unknown, data: { results?: AppleSuggestion[] }) => void, opts?: Record<string, unknown>) => number;
  search: (q: string | AppleSuggestion, cb: (err: unknown, data: { places?: ApplePlace[] }) => void, opts?: Record<string, unknown>) => number;
  cancel: (id: number) => boolean;
};

export type MapKit = {
  init: (o: { authorizationCallback: (done: (token: string) => void) => void; language?: string }) => void;
  Geocoder: new (o?: { language?: string }) => {
    lookup: (q: string, cb: (err: unknown, data: { results: { coordinate: unknown }[] }) => void) => void;
  };
  Search: new (o?: Record<string, unknown>) => Search;
  Map: (new (el: HTMLElement, o: Record<string, unknown>) => {
    region: unknown;
    addAnnotation: (a: unknown) => void;
    destroy: () => void;
  }) & { ColorSchemes: { Light: string; Dark: string } };
  Coordinate: new (lat: number, lng: number) => Coordinate;
  CoordinateRegion: new (c: unknown, s: unknown) => unknown;
  CoordinateSpan: new (a: number, b: number) => unknown;
  MarkerAnnotation: new (c: unknown, o: Record<string, unknown>) => unknown;
  FeatureVisibility: { Hidden: string };
};

let loading: Promise<MapKit | null> | null = null;

/** Apple's MapKit JS, loaded and signed in once per page. */
export function loadMapKit(): Promise<MapKit | null> {
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
        // Apple not answering: carry on without it
        window.setTimeout(() => reject(new Error("MapKit took too long")), 10_000);
        document.head.appendChild(s);
      });
    }
    const mk = w.mapkit!;
    mk.init({ authorizationCallback: (done) => done(token), language: "en-GB" });
    return mk;
  })().catch(() => null);
  return loading;
}
