// A squad player's photo (lib/playerPhoto.ts). A child's photo: only the
// club's coaches and admins, and the child's own parents or carers, can see
// or change it.
//   GET    ?id=…[&key=…]         -> the photo
//   PUT    ?key=… { id, image }  -> a JPEG data: URL, already made small and square in the browser
//   DELETE ?id=…[&key=…]         -> remove it
import { NextRequest, NextResponse } from "next/server";
import { childrenOf } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { currentPerson } from "@/lib/people";
import { MAX_PLAYER_PHOTO_BYTES, deletePlayerPhoto, getPlayerPhoto, setPlayerPhoto } from "@/lib/playerPhoto";
import { listPlayers } from "@/lib/statsStorage";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Whether this request may see or change player `id`'s photo: a coach, or the child's own guardian. */
async function allowed(req: NextRequest, id: string): Promise<boolean> {
  if (!id) return false;
  if (await isCoach(req.nextUrl.searchParams.get("key") ?? "")) return true;
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  if (me?.person?.status !== "approved") return false;
  if (me.person.roles.includes("admin") || me.person.roles.includes("coach")) return true;
  return childrenOf(me.person).some((c) => c.playerId === id);
}

const refused = () => NextResponse.json({ error: "Not allowed" }, { status: 403 });

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!(await allowed(req, id))) return refused();
  const photo = await getPlayerPhoto(id);
  if (!photo) return NextResponse.json({ error: "No photo" }, { status: 404 });
  return new NextResponse(new Uint8Array(photo), {
    // ?v= changes with each upload; private, so no shared cache keeps it
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
  });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; image?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!(await allowed(req, id))) return refused();
  if (!(await listPlayers()).some((p) => p.id === id)) return NextResponse.json({ error: "No such player" }, { status: 404 });
  const match = typeof body?.image === "string" ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.image) : null;
  if (!match) return NextResponse.json({ error: "That isn't a photo" }, { status: 400 });
  const jpeg = Buffer.from(match[1], "base64");
  // a JPEG starts FF D8 FF
  if (jpeg.length < 3 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff) {
    return NextResponse.json({ error: "That isn't a photo" }, { status: 400 });
  }
  if (jpeg.length > MAX_PLAYER_PHOTO_BYTES) return NextResponse.json({ error: "That photo is too big" }, { status: 413 });
  await setPlayerPhoto(id, jpeg);
  return NextResponse.json({ ok: true, v: String(Date.now()) });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!(await allowed(req, id))) return refused();
  await deletePlayerPhoto(id);
  return NextResponse.json({ ok: true });
}
