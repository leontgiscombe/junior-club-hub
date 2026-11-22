// GET /api/fixtures/player?team=… -> { upcoming, results }
// A team's coming games and latest results, for the Training Hub's Games tab:
// a player's own device (their team only), or a member whose (or whose
// child's) team it is. Never line-ups, answers or anyone's names.
import { NextResponse } from "next/server";
import { teamsOf } from "@/lib/access";
import { listMatches } from "@/lib/matchStorage";
import { canCoach, currentPerson } from "@/lib/people";
import { currentPlayer, playerView } from "@/lib/playerRequest";
import { getTenant } from "@/lib/tenant";
import { ukToday } from "@/lib/fixtureFormat";
import { outcome } from "@/lib/record";

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
  if (!team || !(await allowed(team))) return NextResponse.json({ error: "Unauthorised" }, { status: 401, headers });
  const today = ukToday();
  const ours = (await listMatches()).filter((m) => m.team === team);
  const upcoming = ours
    .filter((m) => !m.resultLogged && m.date >= today && m.calledOff !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 6)
    .map((m) => ({
      date: m.date,
      time: m.time,
      meetTime: m.meetTime,
      opponent: m.opponent,
      home: m.home,
      venue: m.venue,
      postponed: m.calledOff === "postponed",
      kind: m.cup ? "Cup" : m.friendly ? "Friendly" : "League",
    }));
  const results = ours
    .filter((m) => m.resultLogged && !m.calledOff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
    .map((m) => ({ date: m.date, opponent: m.opponent, home: m.home, us: m.goals.length, them: m.opponentGoals, outcome: outcome(m) }));
  return NextResponse.json({ upcoming, results }, { headers });
}
