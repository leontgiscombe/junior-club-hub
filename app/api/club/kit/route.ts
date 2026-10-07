// The club's uploaded kit picture (Coach Admin → Settings). Each upload gets a
// new ?v= in its address, so the image can be cached for good.
import { NextResponse, type NextRequest } from "next/server";
import { requestBase } from "@/lib/safeNext";
import { DEFAULT_KIT_IMAGE } from "@/lib/clubSettings";
import { getImage } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const kit = await getImage("kit");
  if (!kit) return NextResponse.redirect(new URL(DEFAULT_KIT_IMAGE.src, requestBase(req)));
  return new NextResponse(Buffer.from(kit.data, "base64"), {
    headers: { "content-type": kit.type, "cache-control": "public, max-age=31536000, immutable" },
  });
}
