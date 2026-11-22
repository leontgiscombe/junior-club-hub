// GET /api/places?q=… -> { places: { name, address }[] }
// Address search for a game's ground, as a coach types (app/admin/fixtures):
// up to six UK places from Photon (photon.komoot.io), the free search built on
// OpenStreetMap — no account or key needed. Asked from the server, so the
// coach's phone only ever talks to the hub. Coaches only; what's typed is sent
// on, nothing about who typed it.
import { NextResponse } from "next/server";
import { canCoach, currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";

// the UK, roughly: west, south, east, north
const UK = "-8.7,49.8,1.9,60.9";

type Feature = { properties?: Record<string, string | undefined> };

/** A place as a coach reads it: its name (a ground, a school, a park) and its address. */
function toPlace(p: Record<string, string | undefined>): { name: string; address: string } | null {
  // a road found on its own is named for itself, with no street of its own
  const street = [p.housenumber, p.street ?? (p.type === "street" ? p.name : "")].filter(Boolean).join(" ");
  const town = p.locality ?? p.district ?? p.city ?? p.town ?? p.village;
  const lines = [street, town !== p.name ? town : "", p.city && p.city !== town ? p.city : "", p.postcode].filter(Boolean);
  // a road or a town on its own has nothing to call it but its address
  const named = p.name && p.name !== p.street && !["street", "city", "town", "village", "district", "county", "state"].includes(p.type ?? "");
  const address = [...new Set(lines)].join(", ");
  if (!named && !address) return null;
  return { name: named ? p.name! : "", address: address || [p.name, p.county].filter(Boolean).join(", ") };
}

export async function GET(request: Request) {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  if (!canCoach(me?.person ?? null)) return NextResponse.json({ error: "Coaches only" }, { status: 403 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ places: [] });
  try {
    const url = `https://photon.komoot.io/api/?${new URLSearchParams({ q, limit: "8", lang: "en", bbox: UK })}`;
    const res = await fetch(url, {
      headers: { "user-agent": "GrassrootsClubHub/1.0 (fixture ground search)" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = (await res.json()) as { features?: Feature[] };
    const seen = new Set<string>();
    const places = (data.features ?? [])
      .map((f) => toPlace(f.properties ?? {}))
      .filter((p): p is { name: string; address: string } => {
        if (!p) return false;
        const key = `${p.name}|${p.address}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
    return NextResponse.json({ places }, { headers: { "cache-control": "private, max-age=300" } });
  } catch (e) {
    console.error("Place search failed:", e);
    return NextResponse.json({ places: [], error: "Address search isn't answering — type it in instead" }, { status: 502 });
  }
}
