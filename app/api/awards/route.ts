import { NextResponse } from "next/server";
import { childrenOf } from "@/lib/access";
import { currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";
import { getTeams } from "@/lib/settings";
import { getCurrentSeason } from "@/lib/season";
import { validAwardChoices } from "@/lib/seasonAwards";
import { activeAwardTeams, getSeasonAward, listSeasonAwards, ownAwardBallot, submitAwardBallot } from "@/lib/seasonAwardsStorage";

export const runtime = "nodejs";

async function parent() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant) : null;
  if (me?.person?.status !== "approved") return null;
  const teams = childrenOf(me.person).filter((child) => !child.pending && child.team).map((child) => child.team!.slug);
  return teams.length ? { userId: me.user.id, teams } : null;
}

export async function GET() {
  try {
    const me = await parent();
    if (!me) return NextResponse.json({ error: "Sign in with an approved parent account linked to a team." }, { status: 403 });
    const season = await getCurrentSeason();
    const activeTeams = (await activeAwardTeams(season)).filter((team) => me.teams.includes(team));
    if (!activeTeams.length) return NextResponse.json({ error: "Awards are not available." }, { status: 404 });
    const [teams, all] = await Promise.all([getTeams(), listSeasonAwards()]);
    const awards = await Promise.all(all.filter((award) => award.season === season && activeTeams.includes(award.team)).map(async (award) => ({ ...award, ballot: await ownAwardBallot(award.id, me.userId) })));
    return NextResponse.json({ season, activeTeams, teams: teams.filter((team) => activeTeams.includes(team.slug)).map(({ slug, name }) => ({ slug, name })), awards }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Awards could not be loaded. Please try again later." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const me = await parent();
    if (!me) return NextResponse.json({ error: "Sign in with an approved parent account linked to a team." }, { status: 403 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Choose an award." }, { status: 400 });
    const award = await getSeasonAward(body.id);
    if (!award || !me.teams.includes(award.team)) return NextResponse.json({ error: "That award is not available for your teams." }, { status: 403 });
    const season = await getCurrentSeason();
    if (!(await activeAwardTeams(season)).includes(award.team)) return NextResponse.json({ error: "Awards are not available." }, { status: 404 });
    if (!award.open || award.season !== season) return NextResponse.json({ error: "Voting for this award is closed." }, { status: 409 });
    if (!validAwardChoices(body.choices, award.nominees.map((player) => player.id))) {
      return NextResponse.json({ error: "Choose one to three different players from this team's nominees." }, { status: 400 });
    }
    if (!(await submitAwardBallot(award.id, me.userId, season, body.choices))) return NextResponse.json({ error: "Voting has closed or awards are no longer available. Your ballot was not changed." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Your ballot could not be saved. Please try again later." }, { status: 503 });
  }
}