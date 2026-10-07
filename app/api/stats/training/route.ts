// GET   /api/stats/training?key=...  -> { sessions: TrainingSession[] }
// PATCH /api/stats/training?key=...  -> { team, date, action, ... }
//         action "set-best-trainer" { playerId }  ("" clears)
//         action "set-cancelled"    { cancelled } — training called off
//
// The best trainer adjusts the season tallies, so the response returns the
// refreshed players alongside the session.
import { NextResponse } from "next/server";
import {
  isTrainingDate,
  listTraining,
  setBestTrainer,
  setCancelled,
  type TrainingSession,
} from "@/lib/trainingStorage";
import { listPlayers } from "@/lib/statsStorage";
import { checkAdminPassword } from "@/lib/adminAuth";
import { isTeam } from "@/lib/settings";

export const runtime = "nodejs";

function isAuthorised(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  return checkAdminPassword(key, process.env.ADMIN_KEY);
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const sessions = await listTraining();
  return NextResponse.json({ sessions });
}

export async function PATCH(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const team = String(body.team ?? "");
  const date = String(body.date ?? "");
  if (!(await isTeam(team))) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }
  if (!isTrainingDate(date)) {
    return NextResponse.json({ error: "No training that day" }, { status: 400 });
  }

  let session: TrainingSession;
  if (body.action === "set-best-trainer") {
    // "" clears the award
    session = await setBestTrainer(team, date, String(body.playerId ?? ""));
  } else if (body.action === "set-cancelled") {
    session = await setCancelled(team, date, Boolean(body.cancelled));
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const players = await listPlayers();
  return NextResponse.json({ success: true, session, players });
}
