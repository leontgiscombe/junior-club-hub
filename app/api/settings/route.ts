// Coach Admin → Settings: the club's name, initials, slogan, season, whether
// results are public, and its pictures (crest and kit). Behind the Coach Admin password.
//   GET    ?key=…                         -> { club, defaults, changes, crest, kitImage, teams }
//   PUT    ?key=…  { changes?, teams?, account? } -> saves the identity changes, teams,
//                                            and/or the club's email or coach password
//   POST   ?key=…  { image, width, height, slot? } -> uploads the crest, or the kit
//                                            picture with slot "kit" (a data: URL)
//   DELETE ?key=…[&slot=kit]              -> goes back to the default crest (or kit picture)
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { DEFAULT_CLUB, cleanChanges, cleanTeams } from "@/lib/clubSettings";
import {
  getAllTeams,
  getClub,
  getClubChanges,
  getImageInfo,
  saveClubChanges,
  saveImage,
  type ImageSlot,
  saveTeams,
} from "@/lib/settings";
import { DEFAULT_TENANT, getTenant } from "@/lib/tenant";
import { getTenantRecord, setTenantEmail, setTenantPassword } from "@/lib/tenants";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
// the crest is small; the kit picture is a wide photo (both are shrunk in the browser first)
const MAX_BYTES: Record<ImageSlot, number> = { crest: 400 * 1024, kit: 600 * 1024 };
const MAX_SIDE: Record<ImageSlot, number> = { crest: 2000, kit: 2400 };
const slotOf = (v: unknown): ImageSlot => (v === "kit" ? "kit" : "crest");

const authorised = (req: NextRequest) => isCoach(req.nextUrl.searchParams.get("key") ?? "");
const unauthorised = () => NextResponse.json({ error: "Incorrect password" }, { status: 401 });
const failed = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "That didn't save" }, { status: 500 });

async function snapshot() {
  const [club, changes, crest, kit, teams] = await Promise.all([
    getClub(),
    getClubChanges(),
    getImageInfo("crest"),
    getImageInfo("kit"),
    getAllTeams(),
  ]);
  // a club on the platform has its own email and password; a single-club hub uses ADMIN_KEY
  const tenant = await getTenant();
  const record = tenant && tenant !== DEFAULT_TENANT ? await getTenantRecord(tenant) : null;
  return {
    club,
    defaults: DEFAULT_CLUB,
    changes,
    crest: crest ? { width: crest.width, height: crest.height, updatedAt: crest.updatedAt } : null,
    kitImage: kit ? { width: kit.width, height: kit.height, updatedAt: kit.updatedAt } : null,
    teams,
    account: record ? { email: record.email } : null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorised(req))) return unauthorised();
  return NextResponse.json(await snapshot());
}

export async function PUT(req: NextRequest) {
  if (!(await authorised(req))) return unauthorised();
  const body = (await req.json().catch(() => null)) as
    | { changes?: unknown; teams?: unknown; account?: { email?: unknown; password?: unknown } }
    | null;
  try {
    if (body?.account) {
      const tenant = await getTenant();
      if (!tenant || tenant === DEFAULT_TENANT) {
        return NextResponse.json({ error: "This hub's password is set where it's hosted (ADMIN_KEY)" }, { status: 400 });
      }
      const { email, password } = body.account;
      if (email !== undefined) {
        const e = typeof email === "string" ? email.trim().slice(0, 120) : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
        }
        await setTenantEmail(tenant, e);
      }
      if (password !== undefined) {
        if (typeof password !== "string" || password.length < 8) {
          return NextResponse.json({ error: "The new password needs at least 8 characters" }, { status: 400 });
        }
        await setTenantPassword(tenant, password);
      }
    }
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
    | { image?: unknown; width?: unknown; height?: unknown; slot?: unknown }
    | null;
  const slot = slotOf(body?.slot);
  const match = typeof body?.image === "string" ? /^data:([\w/+.-]+);base64,(.+)$/.exec(body.image) : null;
  const width = Number(body?.width), height = Number(body?.height);
  if (!match || !IMAGE_TYPES.includes(match[1])) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP image" }, { status: 400 });
  }
  if (!(width > 0 && height > 0 && width <= MAX_SIDE[slot] && height <= MAX_SIDE[slot])) {
    return NextResponse.json({ error: "That image's size doesn't look right" }, { status: 400 });
  }
  if (Buffer.byteLength(match[2], "base64") > MAX_BYTES[slot]) {
    return NextResponse.json({ error: "That image is too big — try a smaller one" }, { status: 400 });
  }
  try {
    await saveImage(slot, {
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
    await saveImage(slotOf(req.nextUrl.searchParams.get("slot")), null);
    return NextResponse.json(await snapshot());
  } catch (e) {
    return failed(e);
  }
}
