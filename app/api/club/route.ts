// The club's details for the plain pages in public/ (Financial Admin and the
// Training Hub): name, crest, slogan, teams and the public key for reminders.
import { NextResponse } from "next/server";
import { getClub, getTeams } from "@/lib/settings";
import { clubColourVars } from "@/lib/palette";
import { getTenant } from "@/lib/tenant";
import { tenantExists } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getTenant();
  if (!tenant || !(await tenantExists(tenant))) return NextResponse.json({ error: "No club here" }, { status: 404 });
  const [CLUB, TEAMS] = await Promise.all([getClub(), getTeams()]);
  return NextResponse.json({
    club: {
      name: CLUB.name,
      fullName: CLUB.fullName,
      slogan: CLUB.slogan,
      season: CLUB.kitSeason,
      crest: CLUB.crest.src,
      features: CLUB.features,
    },
    teams: TEAMS.map((t) => ({
      id: t.slug,
      name: `${CLUB.name} ${t.squadName ?? t.name}`,
    })),
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    colourVars: clubColourVars(CLUB.colour),
  });
}
