// GET /api/training/next?team=... -> { session: NextSession | null }
// A team's next session on its training plan, as its players and families see
// it (lib/nextSession.ts) — for the Training Hub's Up next. Only for that
// team: a player's own device, or a club member whose team (or child's) it is;
// coaches see any team's.
import { NextResponse } from "next/server";
import { teamsOf } from "@/lib/access";
import { nextSessionFor } from "@/lib/nextSession";
import { canCoach, currentPerson } from "@/lib/people";
import { currentPlayer, playerView } from "@/lib/playerRequest";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function allowed(team: string): Promise<boolean> {
  const player = await currentPlayer();
  if (player) return (await playerView(player))?.team?.slug === team;
  const tenant = await getTenant();
  const person = tenant ? (await currentPerson(tenant))?.person ?? null : null;
  if (person?.status !== "approved") return false;
  return canCoach(person) || teamsOf(person).includes(team);
}

export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get("team") ?? "";
  const headers = { "cache-control": "no-store" };
  if (!team || !(await allowed(team))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers });
  }
  const club = await getClub();
  const session = club.features.trainingPlans ? await nextSessionFor(team) : null;
  return NextResponse.json({ session }, { headers });
}
