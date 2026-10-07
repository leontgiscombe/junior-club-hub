// The club's uploaded crest (Coach Admin → Settings). Each upload gets a new
// ?v= in its address, so the image can be cached for good.
import { NextResponse } from "next/server";
import { DEFAULT_CLUB } from "@/lib/clubSettings";
import { getCrest } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const crest = await getCrest();
  if (!crest) return NextResponse.redirect(new URL(DEFAULT_CLUB.crest.src, req.url));
  return new NextResponse(Buffer.from(crest.data, "base64"), {
    headers: { "content-type": crest.type, "cache-control": "public, max-age=31536000, immutable" },
  });
}
