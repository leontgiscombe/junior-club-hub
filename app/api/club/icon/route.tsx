// Home-screen icons made from the uploaded crest: the crest on the dark,
// green-washed background of the default icons. ?size=180 or 512.
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getCrest } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const size = new URL(req.url).searchParams.get("size") === "512" ? 512 : 180;
  const crest = await getCrest();
  if (!crest) return NextResponse.redirect(new URL(`/hub-icon-${size}.png`, req.url));
  const h = Math.round(size * 0.74);
  const w = Math.round((h * crest.width) / crest.height);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 46%, #1f5c2c 0%, #0b2412 55%, #060906 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:${crest.type};base64,${crest.data}`} width={w} height={h} alt="" />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    },
  );
}
