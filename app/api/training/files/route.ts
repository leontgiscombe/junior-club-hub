// GET /api/training/files?key=...&name=...  -> a built-in drill's session-plan
// file (a page image or the PDF), for signed-in coaches only.
// GET /api/training/files?key=...&drill=...&file=... -> a photo or PDF a coach
// added to a drill (lib/trainingPlans.ts addDrillUpload), likewise. The files live in
// the drill pack's drill-pack/files/ rather than public/, so they're never
// served without the password; only names of built-in drills' files (see
// lib/builtInDrills.ts) can be asked for.
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { builtInFile } from "@/lib/builtInDrills";
import { getDrillUpload } from "@/lib/trainingPlans";

export const runtime = "nodejs";

// by extension: the first drills' pages are PNGs, the season plan's JPEGs
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  pdf: "application/pdf",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!(await isCoach(searchParams.get("key") ?? ""))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (searchParams.get("drill")) {
    const found = await getDrillUpload(searchParams.get("drill") ?? "", searchParams.get("file") ?? "");
    if (!found) return NextResponse.json({ error: "No such file" }, { status: 404 });
    const filename = found.upload.label.replace(/[^\w .()-]/g, "_");
    return new NextResponse(new Uint8Array(Buffer.from(found.data, "base64")), {
      headers: {
        "Content-Type": found.mime,
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  const file = builtInFile(searchParams.get("name") ?? "");
  if (!file) return NextResponse.json({ error: "No such file" }, { status: 404 });

  const body = await readFile(path.join(process.cwd(), "drill-pack", "files", file.name));
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[file.name.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${file.name}"`,
      // the password is in the URL, so keep it out of shared caches
      "Cache-Control": "private, max-age=3600",
    },
  });
}
