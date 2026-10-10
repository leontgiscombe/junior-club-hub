// The signed-in person's profile photo (lib/userPhoto.ts).
//   GET           -> the photo (only your own)
//   PUT { image } -> a JPEG data: URL, already made small and square in the browser
//   DELETE        -> remove it
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { MAX_PHOTO_BYTES, deletePhoto, getPhoto, setPhoto } from "@/lib/userPhoto";

export const dynamic = "force-dynamic";

const notSignedIn = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });

export async function GET() {
  const user = await currentUser();
  if (!user) return notSignedIn();
  const photo = await getPhoto(user.id);
  if (!photo) return NextResponse.json({ error: "No photo" }, { status: 404 });
  return new NextResponse(new Uint8Array(photo), {
    // ?v= changes with each upload; private, so no shared cache keeps it
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
  });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return notSignedIn();
  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const match = typeof body?.image === "string" ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.image) : null;
  if (!match) return NextResponse.json({ error: "That isn't a photo" }, { status: 400 });
  const jpeg = Buffer.from(match[1], "base64");
  // a JPEG starts FF D8 FF
  if (jpeg.length < 3 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff) {
    return NextResponse.json({ error: "That isn't a photo" }, { status: 400 });
  }
  if (jpeg.length > MAX_PHOTO_BYTES) return NextResponse.json({ error: "That photo is too big" }, { status: 413 });
  await setPhoto(user.id, jpeg);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return notSignedIn();
  await deletePhoto(user.id);
  return NextResponse.json({ ok: true });
}
