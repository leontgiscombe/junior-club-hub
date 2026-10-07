// GET /api/admin-auth?key=...  -> 200 { ok: true } if the password is correct,
// otherwise 401. Used by the /admin landing page to gate access with a single
// login before showing the tools.
import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE, MEMBER_COOKIE_MAX_AGE, SESSION_KEY, readAccess } from "@/lib/access";
import { coachLockedOut, isCoach } from "@/lib/adminAuth";
import { approveCoachPhone } from "@/lib/members";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  if (!(await isCoach(key))) {
    const tenantNow = await getTenant();
    if (key !== SESSION_KEY && tenantNow && (await readAccess(tenantNow).catch(() => null))?.passwordOff) {
      return NextResponse.json({ error: "This club no longer uses a shared password — sign in with your email" }, { status: 403 });
    }
    if (await coachLockedOut()) {
      return NextResponse.json({ error: "Too many wrong passwords — try again in 15 minutes" }, { status: 429 });
    }
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  // a coach's phone can always open the club's hub, even when it's private
  // (someone signed in with an account is let in by their account instead)
  const res = NextResponse.json({ ok: true });
  const tenant = await getTenant();
  if (tenant && key !== SESSION_KEY) {
    try {
      const token = await approveCoachPhone(tenant, request.cookies.get(MEMBER_COOKIE)?.value);
      res.cookies.set(MEMBER_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
        maxAge: MEMBER_COOKIE_MAX_AGE,
        path: "/",
      });
    } catch {}
  }
  return res;
}
