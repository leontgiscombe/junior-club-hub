// The sign-in link in the email: signs this browser in and goes on to where
// the person was heading.
import { NextRequest, NextResponse } from "next/server";
import { createSession, finishLoginWithLink, setSessionCookie } from "@/lib/auth";
import { requestBase, safeNext } from "@/lib/safeNext";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const done = await finishLoginWithLink(req.nextUrl.searchParams.get("id") ?? "", req.nextUrl.searchParams.get("t") ?? "");
  if (!done) return NextResponse.redirect(new URL("/signin?expired=1", requestBase(req)));
  const res = NextResponse.redirect(new URL(safeNext(done.next), requestBase(req)));
  setSessionCookie(res, await createSession(done.user), req);
  return res;
}
