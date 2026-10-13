// Apple's association file, served at /.well-known/apple-app-site-association
// on the platform's address and every club's (proxy.ts rewrites it here). It
// tells iOS the App Store app belongs with this site, so passkeys (Face ID
// sign-in, opening Finances) work inside the app — they're made for the root
// domain (lib/passkeys.ts) — and links to the hub can open in the app. Set
// APPLE_TEAM_ID and IOS_BUNDLE_ID (e.g. ABCDE12345 and uk.co.grassrootsclubhub.app)
// where the site's hosted; until both are, there's nothing to serve.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? "").trim();
  const bundle = (process.env.IOS_BUNDLE_ID ?? "").trim();
  if (!team || !bundle) return NextResponse.json({ error: "Not set up" }, { status: 404 });
  const app = `${team}.${bundle}`;
  return NextResponse.json(
    {
      webcredentials: { apps: [app] },
      applinks: { details: [{ appIDs: [app], components: [{ "/": "/api/*", exclude: true }, { "/": "*" }] }] },
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
