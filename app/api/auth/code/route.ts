// Finish signing in with the code from the email.
//   POST { email, code } -> { next } with the session cookie set
import { NextRequest, NextResponse } from "next/server";
import { cleanEmail, createSession, finishLoginWithCode, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = cleanEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code : "";
  const done = email && code ? await finishLoginWithCode(email, code) : null;
  if (!done) {
    return NextResponse.json({ error: "That code isn't right or has run out — check the latest email, or send a new one" }, { status: 400 });
  }
  const res = NextResponse.json({ next: done.next });
  setSessionCookie(res, await createSession(done.user), req);
  return res;
}
