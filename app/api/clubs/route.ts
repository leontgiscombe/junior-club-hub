// Find your club, by its exact web address: there's no list or search of
// clubs, so nobody can browse who's on the platform. Looking addresses up is
// limited per IP address, so they can't be guessed in bulk.
//   GET ?address=riverside -> { url } or 404
import { NextRequest, NextResponse } from "next/server";
import { rawKv } from "@/lib/kv";
import { TENANT_ID, getTenant, tenantUrl } from "@/lib/tenant";
import { getTenantRecord } from "@/lib/tenants";
import { clientIp } from "@/lib/clientIp";

export const dynamic = "force-dynamic";

const MAX_LOOKUPS = 30; // an hour, per IP address

export async function GET(req: NextRequest) {
  if ((await getTenant()) !== null) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const address = (req.nextUrl.searchParams.get("address") ?? "").trim().toLowerCase();
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ip = clientIp(req.headers);
  const tries = await kv.incr(`platform:lookup-ip:${ip}`);
  if (tries === 1) await kv.expire(`platform:lookup-ip:${ip}`, 3600);
  if (tries > MAX_LOOKUPS) {
    return NextResponse.json({ error: "Too many tries — ask your coach for your club's link" }, { status: 429 });
  }
  const record = TENANT_ID.test(address) ? await getTenantRecord(address) : null;
  if (!record) {
    return NextResponse.json({ error: "No club at that address — check it with your coach" }, { status: 404 });
  }
  return NextResponse.json({ url: tenantUrl(record.id) });
}
