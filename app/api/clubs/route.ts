// Find your club, by its join code (Coach Admin → Members): there's no list or
// search of clubs, so nobody can browse who's on the platform. Lookups are
// limited per IP address, so codes can't be guessed.
//   GET ?code=K7Q-M3X -> { url } (the club's join page) or 404
import { NextRequest, NextResponse } from "next/server";
import { normaliseCode } from "@/lib/access";
import { clientIp } from "@/lib/clientIp";
import { rawKv } from "@/lib/kv";
import { tenantForCode } from "@/lib/members";
import { getTenant, tenantUrl } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const MAX_LOOKUPS = 30; // an hour, per IP address

export async function GET(req: NextRequest) {
  if ((await getTenant()) !== null) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const code = normaliseCode(req.nextUrl.searchParams.get("code") ?? "");
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ipKey = `platform:lookup-ip:${clientIp(req.headers)}`;
  const tries = await kv.incr(ipKey);
  if (tries === 1) await kv.expire(ipKey, 3600);
  if (tries > MAX_LOOKUPS) {
    return NextResponse.json({ error: "Too many tries — ask your coach for your club's link" }, { status: 429 });
  }
  const tenant = await tenantForCode(code);
  if (!tenant) return NextResponse.json({ error: "That code isn't right — check it with your coach" }, { status: 404 });
  return NextResponse.json({ url: tenantUrl(tenant, `/join?code=${code}`) });
}
