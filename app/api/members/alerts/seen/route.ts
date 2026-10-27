// The App Store app has been opened (public/app-feel.js): its phone's count of
// alerts for the icon's red number starts again from nothing (lib/apns.ts).
//   POST { token } -> { ok }
// No account needed: the token is the phone's own, and this only resets a count.
import { NextRequest, NextResponse } from "next/server";
import { clearBadge, isApnsToken } from "@/lib/apns";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  if (!isApnsToken(body?.token)) return NextResponse.json({ error: "That phone's token isn't right" }, { status: 400 });
  await clearBadge(body.token).catch(() => {});
  return NextResponse.json({ ok: true });
}
