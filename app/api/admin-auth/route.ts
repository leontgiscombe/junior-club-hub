// GET /api/admin-auth?key=...  -> 200 { ok: true } if the password is correct,
// otherwise 401. Used by the /admin landing page to gate access with a single
// login before showing the tools.
import { NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  if (!(await isCoach(key))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
