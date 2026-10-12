// Setting up a player's own device with the code a parent or coach made.
//   POST { code } -> { ok } with the player cookie set (and any grown-up's
//   sign-in on this device signed out: it's the child's now)
import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE, SESSION_COOKIE } from "@/lib/access";
import { deviceLabel, playerCookie, redeemPlayerCode } from "@/lib/playerDevices";
import { overLimit } from "@/lib/rateLimit";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Not here" }, { status: 404 });
  // six digits can't be guessed in a few tries
  if (await overLimit("player-link", 10, 3600)) {
    return NextResponse.json({ error: "Too many tries — ask a grown-up for a new code and try again later" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const done = await redeemPlayerCode(tenant, code, deviceLabel(req.headers.get("user-agent") ?? ""));
  if (!done) {
    return NextResponse.json({ error: "That code isn't right or has run out — ask for a new one" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const { name, ...opts } = playerCookie(secure);
  res.cookies.set(name, done.token, opts);
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(MEMBER_COOKIE);
  return res;
}
