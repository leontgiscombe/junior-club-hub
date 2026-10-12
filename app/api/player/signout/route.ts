// A player signing their own device out (a grown-up sets it up again).
//   POST -> { ok }
import { NextResponse } from "next/server";
import { PLAYER_COOKIE } from "@/lib/access";
import { removePlayerDevice } from "@/lib/playerDevices";
import { currentPlayer } from "@/lib/playerRequest";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await currentPlayer();
  if (session) await removePlayerDevice(session.tenant, session.playerId, session.deviceId);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PLAYER_COOKIE);
  return res;
}
