// The camera register is now a view of home games in the match log, so this
// route only exists to carry across fixtures logged in the old standalone
// register (Redis hash `camera_fixtures`).
//
// GET  /api/camera?key=...   -> { legacy: Fixture[] }  still awaiting import
// POST /api/camera?key=...   -> import them as home games, then clear the old
//                               hash -> { imported, matches }
import { NextResponse } from "next/server";
import { listFixtures, clearFixtures } from "@/lib/cameraStorage";
import { addMatch } from "@/lib/matchStorage";
import { checkAdminPassword } from "@/lib/adminAuth";
import { isValidTeam } from "@/lib/teams";

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
  return NextResponse.json({ legacy: await listFixtures() });
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const fixtures = await listFixtures();
  const matches = [];
  for (const fixture of fixtures) {
    if (!isValidTeam(fixture.team)) continue;
    const { match } = await addMatch({
      team: fixture.team,
      opponent: fixture.opponent,
      date: fixture.date,
      time: fixture.time ?? "",
      home: true, // the old register only ever held home games
      friendly: false,
      cameraHolder: fixture.holder ?? "",
      footageUploaded: Boolean(fixture.uploaded),
    });
    matches.push(match);
  }

  if (matches.length > 0) await clearFixtures();
  return NextResponse.json({ success: true, imported: matches.length, matches });
}
