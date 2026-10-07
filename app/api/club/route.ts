// The club's details for the plain pages in public/ (Financial Admin and the
// Training Hub): name, crest, slogan, teams and the public key for reminders.
import { NextResponse } from "next/server";
import { CLUB, TEAMS } from "@/club.config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    club: {
      name: CLUB.name,
      fullName: CLUB.fullName,
      slogan: CLUB.slogan,
      season: CLUB.kitSeason,
      crest: CLUB.crest.src,
    },
    teams: TEAMS.map((t) => ({
      id: t.slug,
      name: `${CLUB.name} ${t.squadName ?? t.name}`,
    })),
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
  });
}
