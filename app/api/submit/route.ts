import { NextResponse } from "next/server";
import { getSubmissions, saveSubmission } from "@/lib/storage";
import { isTeam } from "@/lib/settings";
import { squadPlayer } from "@/lib/kitSquad";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team, childName, shirtSize, shortsSize, socksSize } = body;
    const playerId = typeof body.playerId === "string" ? body.playerId : "";

    if (!(await isTeam(team))) {
      return NextResponse.json({ error: "Unknown team" }, { status: 400 });
    }

    // A child picked from the squad is saved under their full name, looked up
    // here — the public form only ever shows "Jamie S."
    let name = typeof childName === "string" ? childName.trim() : "";
    if (playerId) {
      const player = await squadPlayer(team, playerId);
      if (!player) {
        return NextResponse.json(
          { error: "That player isn't in this team's squad — please refresh the page" },
          { status: 400 }
        );
      }
      name = player.name;
    }

    if (!name || !shirtSize || !shortsSize || !socksSize) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // the same child sent twice: say so rather than quietly keeping both
    const existing = playerId
      ? (await getSubmissions(team)).some((s) => s.playerId === playerId)
      : false;

    const { saved } = await saveSubmission(team, {
      childName: name,
      ...(playerId ? { playerId } : {}),
      shirtSize,
      shortsSize,
      socksSize,
    });

    // nothing about the child goes back to the (public) page
    return NextResponse.json({ success: true, saved, alreadySent: existing });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Failed to save. Use the WhatsApp message below." }, { status: 500 });
  }
}
