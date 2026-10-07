// GET   /api/stats/season?key=...          -> { season, archives: SeasonSummary[] }
// GET   /api/stats/season?key=...&id=...   -> { archive: ArchivedSeason }  (for CSV export)
// POST  /api/stats/season?key=...          -> archive the current season and start a new
//                                             one { newSeason } -> { season, archives }
// PATCH /api/stats/season?key=...          -> restore an archived season { id }
//                                             (the undo for archive & reset)
import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/statsStorage";
import { listMatches } from "@/lib/matchStorage";
import {
  archiveSeason,
  getArchive,
  getCurrentSeason,
  listArchives,
  restoreSeason,
} from "@/lib/season";
import { isCoach } from "@/lib/adminAuth";

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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const archive = await getArchive(id);
    if (!archive) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }
    return NextResponse.json({ archive });
  }

  const [season, archives] = await Promise.all([getCurrentSeason(), listArchives()]);
  return NextResponse.json({ season, archives });
}

export async function POST(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json();
  const newSeason = String(body.newSeason ?? "").trim();
  if (!newSeason) {
    return NextResponse.json({ error: "New season name is required" }, { status: 400 });
  }

  const [players, matches] = await Promise.all([listPlayers(), listMatches()]);
  if (players.length === 0 && matches.length === 0) {
    return NextResponse.json(
      { error: "There is nothing to archive yet" },
      { status: 400 }
    );
  }

  const result = await archiveSeason(newSeason);
  if (!result) {
    return NextResponse.json({ error: "Could not archive the season" }, { status: 500 });
  }

  const [season, archives] = await Promise.all([getCurrentSeason(), listArchives()]);
  return NextResponse.json({ success: true, season, archives });
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

  const result = await restoreSeason(id);
  if (!result) {
    return NextResponse.json({ error: "Could not restore that season" }, { status: 404 });
  }

  const [season, archives, players] = await Promise.all([
    getCurrentSeason(),
    listArchives(),
    listPlayers(),
  ]);
  return NextResponse.json({ success: true, season, archives, players });
}
