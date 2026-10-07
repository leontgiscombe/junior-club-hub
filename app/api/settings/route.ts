// Coach Admin → Settings: the club's name, initials, slogan, season, whether
// results are public, and its crest. Behind the Coach Admin password.
//   GET    ?key=…                         -> { club, defaults, changes, crest, teams }
//   PUT    ?key=…  { changes?, teams? }    -> saves the identity changes and/or teams
//   POST   ?key=…  { image, width, height } -> uploads a crest (a data: URL)
//   DELETE ?key=…                         -> goes back to the default crest
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { DEFAULT_CLUB, cleanChanges, cleanTeams } from "@/lib/clubSettings";
import {
  getAllTeams,
  getClub,
  getClubChanges,
  getCrest,
  saveClubChanges,
  saveCrest,
  saveTeams,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

const CREST_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_CREST_BYTES = 400 * 1024;

const authorised = (req: NextRequest) => isCoach(req.nextUrl.searchParams.get("key") ?? "");
const unauthorised = () => NextResponse.json({ error: "Incorrect password" }, { status: 401 });
const failed = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "That didn't save" }, { status: 500 });

async function snapshot() {
  const [club, changes, crest, teams] = await Promise.all([
    getClub(),
    getClubChanges(),
    getCrest(),
    getAllTeams(),
  ]);
  return {
    club,
    defaults: DEFAULT_CLUB,
    changes,
    crest: crest ? { width: crest.width, height: crest.height, updatedAt: crest.updatedAt } : null,
    teams,
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorised(req))) return unauthorised();
  return NextResponse.json(await snapshot());
}

export async function PUT(req: NextRequest) {
  if (!(await authorised(req))) return unauthorised();
  const body = (await req.json().catch(() => null)) as { changes?: unknown; teams?: unknown } | null;
  try {
    if (body?.teams !== undefined) {
      const teams = cleanTeams(body.teams);
      if (!teams) return NextResponse.json({ error: "Keep at least one team" }, { status: 400 });
      // A team is never dropped, only archived, so its kit sizes, stats,
      // logs and subs stay put and it can be brought back.
      const missing = (await getAllTeams()).filter((t) => !teams.some((n) => n.slug === t.slug));
      if (missing.length) {
        return NextResponse.json(
          { error: `Archive ${missing.map((t) => t.name).join(", ")} instead of removing it` },
          { status: 400 },
        );
      }
      await saveTeams(teams);
    }
    if (body?.changes !== undefined) await saveClubChanges(cleanChanges(body.changes));
    return NextResponse.json(await snapshot());
  } catch (e) {
    return failed(e);
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorised(req))) return unauthorised();
  const body = (await req.json().catch(() => null)) as
    | { image?: unknown; width?: unknown; height?: unknown }
    | null;
  const match = typeof body?.image === "string" ? /^data:([\w/+.-]+);base64,(.+)$/.exec(body.image) : null;
  const width = Number(body?.width), height = Number(body?.height);
  if (!match || !CREST_TYPES.includes(match[1])) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP image" }, { status: 400 });
  }
  if (!(width > 0 && height > 0 && width <= 2000 && height <= 2000)) {
    return NextResponse.json({ error: "That image's size doesn't look right" }, { status: 400 });
  }
  if (Buffer.byteLength(match[2], "base64") > MAX_CREST_BYTES) {
    return NextResponse.json({ error: "That image is too big — try a smaller one" }, { status: 400 });
  }
  try {
    await saveCrest({
      type: match[1],
      data: match[2],
      width: Math.round(width),
      height: Math.round(height),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json(await snapshot());
  } catch (e) {
    return failed(e);
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await authorised(req))) return unauthorised();
  try {
    await saveCrest(null);
    return NextResponse.json(await snapshot());
  } catch (e) {
    return failed(e);
  }
}
