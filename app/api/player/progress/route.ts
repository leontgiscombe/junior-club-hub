// A player's Training Hub progress, kept with them so it follows them to a new device.
//   GET            -> { progress: { week, skills, bests } | null }
//   PUT { progress } -> { ok }
import { NextRequest, NextResponse } from "next/server";
import { cleanProgress, getProgress, saveProgress } from "@/lib/playerDevices";
import { currentPlayer } from "@/lib/playerRequest";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentPlayer();
  if (!session) return NextResponse.json({ error: "Not a player's device" }, { status: 401 });
  return NextResponse.json({ progress: await getProgress(session.tenant, session.playerId) }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const session = await currentPlayer();
  if (!session) return NextResponse.json({ error: "Not a player's device" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { progress?: unknown } | null;
  const progress = cleanProgress(body?.progress);
  if (!progress) return NextResponse.json({ error: "bad progress" }, { status: 400 });
  await saveProgress(session.tenant, session.playerId, progress);
  return NextResponse.json({ ok: true });
}
