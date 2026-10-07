// The club's uploaded crest (Coach Admin → Settings). Each upload gets a new
// ?v= in its address, so the image can be cached for good.
import { NextResponse, type NextRequest } from "next/server";
import { requestBase } from "@/lib/safeNext";
import { DEFAULT_CLUB } from "@/lib/clubSettings";
import { getCrest } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const crest = await getCrest();
  if (!crest) return NextResponse.redirect(new URL(DEFAULT_CLUB.crest.src, requestBase(req)));
  return new NextResponse(Buffer.from(crest.data, "base64"), {
    headers: { "content-type": crest.type, "cache-control": "public, max-age=31536000, immutable" },
  });
}
