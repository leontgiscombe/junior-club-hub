// Which club a player's setup code is for, so the app's opening screen
// (/start) can send a child to their club's setup page without them knowing
// its address. Doesn't use the code up; tries are limited per address.
//   GET ?code=123456 -> { url, home, name } (the club's /player page with the code, its address and name) or 404
import { NextRequest, NextResponse } from "next/server";
import { playerCodeTenant } from "@/lib/playerDevices";
import { overLimit } from "@/lib/rateLimit";
import { tenantUrl } from "@/lib/tenant";
import { getTenantRecord } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (await overLimit("player-find", 10, 3600, false)) {
    return NextResponse.json({ error: "Too many tries — ask a grown-up for a new code and try again later" }, { status: 429 });
  }
  const code = (req.nextUrl.searchParams.get("code") ?? "").replace(/\D/g, "");
  const tenant = await playerCodeTenant(code);
  if (!tenant) return NextResponse.json({ error: "That code isn't right or has run out — ask for a new one" }, { status: 404 });
  const record = await getTenantRecord(tenant);
  return NextResponse.json({ url: tenantUrl(tenant, `/player?code=${code}`), home: tenantUrl(tenant, "/"), name: record?.name ?? "" });
}
