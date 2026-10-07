// Sign this device out.
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, endSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await endSession().catch(() => {});
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req);
  return res;
}
