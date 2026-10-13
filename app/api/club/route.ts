// The club's details for the plain pages in public/ (Financial Admin and the
// Training Hub): name, crest, slogan, teams and the public key for reminders.
import { NextResponse } from "next/server";
import { getClub, getTeams } from "@/lib/settings";
import { teamFormat } from "@/lib/clubSettings";
import { clubColourVars } from "@/lib/palette";
import { getTenant } from "@/lib/tenant";
import { tenantExists } from "@/lib/tenants";
import { vapidKeys } from "@/lib/vapid";
import { sharedPasswordOn } from "@/lib/adminAuth";

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
      publicResults: CLUB.publicResults,
    },
    teams: TEAMS.map((t) => ({
      id: t.slug,
      name: `${CLUB.name} ${t.squadName ?? t.name}`,
      // just the team, e.g. "U10 Greens" (the Training Hub's header)
      short: t.name,
      // which Training Hub content its players see
      format: teamFormat(t),
    })),
    vapidPublicKey: (await vapidKeys())?.publicKey ?? null,
    // whether a shared coach password works here (Finances' set-up offers it only then)
    coachPassword: await sharedPasswordOn(tenant),
    colourVars: clubColourVars(CLUB.colour),
  });
}
