import { NextResponse } from "next/server";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { currentPerson } from "@/lib/people";
import { parentKitData } from "@/lib/parentKit";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tenant = await getTenant();
    const me = tenant ? await currentPerson(tenant) : null;
    if (me?.person?.status !== "approved") return NextResponse.json({ error: "Sign in with an approved club account." }, { status: 403 });
    if (!(await getClub()).features.kitSizes) return NextResponse.json({ error: "Kit is not available." }, { status: 404 });
    return NextResponse.json(await parentKitData(me.person), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Your kit details could not be loaded. Please try again." }, { status: 503 });
  }
}