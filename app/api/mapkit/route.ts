// GET /api/mapkit -> { token } for Apple's MapKit JS, which draws the map on a
// fixture's page (app/fixtures/VenueMap.tsx); 404 when it isn't set up, and
// the page shows the address with a button to open it in Apple Maps instead.
//
// Setting it up: in the Apple Developer account (the same one as the App
// Store app), Certificates, IDs & Profiles → Keys, make a key with MapKit JS
// ticked, then set MAPKIT_KEY (the .p8 file's text), MAPKIT_KEY_ID (its Key ID)
// and APPLE_TEAM_ID (already set for the app's alerts).
import { createPrivateKey, sign } from "crypto";
import { NextResponse } from "next/server";
import { currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export async function GET() {
  const key = (process.env.MAPKIT_KEY ?? "").replace(/\\n/g, "\n").trim();
  const keyId = (process.env.MAPKIT_KEY_ID ?? "").trim();
  const team = (process.env.APPLE_TEAM_ID ?? "").trim();
  if (!key || !keyId || !team) return NextResponse.json({ error: "Maps aren't set up" }, { status: 404 });
  // members only: the token is the club's to use
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  if (me?.person?.status !== "approved") return NextResponse.json({ error: "Sign in" }, { status: 403 });
  try {
    const now = Math.floor(Date.now() / 1000);
    const head = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
    const body = b64url(JSON.stringify({ iss: team, iat: now, exp: now + 30 * 60 }));
    const signature = sign("sha256", Buffer.from(`${head}.${body}`), {
      key: createPrivateKey(key),
      dsaEncoding: "ieee-p1363",
    });
    return NextResponse.json({ token: `${head}.${body}.${b64url(signature)}` }, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    console.error("MapKit token not made:", e);
    return NextResponse.json({ error: "Maps aren't set up" }, { status: 404 });
  }
}
