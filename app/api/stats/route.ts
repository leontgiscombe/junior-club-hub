// GET    /api/stats?key=...          -> { players: Player[], season, archives: SeasonSummary[] }
// POST   /api/stats?key=...          -> add a player { team, name }
// PATCH  /api/stats?key=...          -> update a player { id, name?, position?, <stat fields> }
// DELETE /api/stats?key=...&id=...   -> remove a player
import { NextResponse } from "next/server";
import {
  addPlayer,
  listPlayers,
  updatePlayer,
  isPosition,
  STAT_FIELDS,
} from "@/lib/statsStorage";
import { getCurrentSeason, listArchives } from "@/lib/season";
import { isClubAdmin, isCoach } from "@/lib/adminAuth";
import { deleteSquadPlayer } from "@/lib/people";
import { deletePlayerPhoto } from "@/lib/playerPhoto";
import { requireTenant } from "@/lib/tenant";
import { isTeam } from "@/lib/settings";
import { playerPhotoVersions } from "@/lib/playerPhoto";

export const runtime = "nodejs";

async function isAuthorised(request: Request): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  return isCoach(key);
}

export async function GET(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const [players, season, archives, photos] = await Promise.all([
    listPlayers(),
    getCurrentSeason(),
    listArchives(),
    // each player's photo version (lib/playerPhoto.ts), for the list's avatars
    playerPhotoVersions().catch(() => ({})),
  ]);
  return NextResponse.json({ players, season, archives, photos });
}

export async function POST(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json();
  const team = String(body.team ?? "");
  const name = String(body.name ?? "").trim();

  if (!(await isTeam(team))) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Player name is required" }, { status: 400 });
  }

  const position = isPosition(body.position) ? body.position : "outfield";
  const { saved, player } = await addPlayer({ team, name, position });
  return NextResponse.json({ success: true, saved, player });
}

export async function PATCH(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = String(body.name ?? "");
  if ("position" in body) {
    if (!isPosition(body.position)) {
      return NextResponse.json({ error: "Unknown position" }, { status: 400 });
    }
    patch.position = body.position;
  }
  for (const field of STAT_FIELDS) {
    if (field in body) patch[field] = body[field];
  }

  const ok = await updatePlayer(id, patch);
  return NextResponse.json({ success: ok });
}

// taking a player out of the squad is a club admin's, as in Members (app/api/players):
// with their medical notes, devices, links to parents and photo
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!(await isClubAdmin(searchParams.get("key") ?? ""))) {
    return NextResponse.json({ error: "Only a club admin can remove players" }, { status: 403 });
  }
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await deleteSquadPlayer(await requireTenant(), id);
  await deletePlayerPhoto(id).catch(() => {});
  return NextResponse.json({ success: true });
}
