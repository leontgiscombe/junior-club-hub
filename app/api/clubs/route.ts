// Find your club: the clubs on the platform whose name or address matches ?q=.
import { NextRequest, NextResponse } from "next/server";
import { getTenant, tenantUrl } from "@/lib/tenant";
import { listTenants } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if ((await getTenant()) !== null) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ clubs: [] });
  const clubs = (await listTenants())
    .filter((t) => t.name.toLowerCase().includes(q) || t.id.includes(q))
    .slice(0, 20)
    .map((t) => ({ name: t.name, url: tenantUrl(t.id) }));
  return NextResponse.json({ clubs });
}
