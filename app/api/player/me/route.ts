// The player this device is set up for, if it is one.
//   GET -> { player: { firstName, initials, team } | null }
import { NextResponse } from "next/server";
import { currentPlayer, playerView } from "@/lib/playerRequest";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentPlayer();
  const player = session ? await playerView(session) : null;
  return NextResponse.json({ player }, { headers: { "cache-control": "no-store" } });
}
