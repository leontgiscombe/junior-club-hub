import { NextResponse } from "next/server";
import { getSubmissions, saveSubmission } from "@/lib/storage";
import { getClub, isTeam } from "@/lib/settings";
import { squadPlayer } from "@/lib/kitSquad";
import type { KitExtra } from "@/lib/clubSettings";
import { overLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  // the form is open to anyone with the club's link: a family sends a few, a script many
  if (await overLimit("kit-submit", 30, 3600)) {
    return NextResponse.json({ error: "That's a lot of kit forms — please try again later" }, { status: 429 });
  }
  try {
    const body = await request.json();
    const { team, childName, shirtSize, shortsSize, socksSize } = body;
    const playerId = typeof body.playerId === "string" ? body.playerId : "";

    const club = await getClub();
    if (!club.features.kitSizes) {
      return NextResponse.json({ error: "Kit sizes aren't being collected" }, { status: 404 });
    }
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

    // the club's extra kit items (a size, or "Not needed"), each one required
    const sent = body.extras && typeof body.extras === "object" ? (body.extras as Record<string, unknown>) : {};
    const extras: Partial<Record<KitExtra, string>> = {};
    for (const e of club.kitExtras) {
      const v = typeof sent[e] === "string" ? (sent[e] as string).trim().slice(0, 12) : "";
      if (v) extras[e] = v;
    }

    if (!name || !shirtSize || !shortsSize || !socksSize || club.kitExtras.some((e) => !extras[e])) {
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
      ...(Object.keys(extras).length ? { extras } : {}),
    });

    // nothing about the child goes back to the (public) page
    return NextResponse.json({ success: true, saved, alreadySent: existing });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Failed to save. Use the WhatsApp message below." }, { status: 500 });
  }
}
