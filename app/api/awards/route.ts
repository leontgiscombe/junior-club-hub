import { NextResponse } from "next/server";
import { childrenOf } from "@/lib/access";
import { currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";
import { getTeams } from "@/lib/settings";
import { getCurrentSeason } from "@/lib/season";
import { awardSlotsFor, ballotField, nomineesFor, validAwardChoices } from "@/lib/seasonAwards";
import { activeAwardTeams, getSeasonAward, listSeasonAwards, ownAwardBallot, submitAwardBallot } from "@/lib/seasonAwardsStorage";

export const runtime = "nodejs";

async function parent() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant) : null;
  if (me?.person?.status !== "approved") return null;
  const kids = childrenOf(me.person);
  const teams = kids.filter((child) => !child.pending && child.team).map((child) => child.team!.slug);
  return teams.length ? { userId: me.user.id, name: me.person.name, kids, teams } : null;
}

export async function GET() {
  try {
    const me = await parent();
    if (!me) return NextResponse.json({ error: "Sign in with an approved parent account linked to a team." }, { status: 403 });
    const season = await getCurrentSeason();
    const activeTeams = (await activeAwardTeams(season)).filter((team) => me.teams.includes(team));
    if (!activeTeams.length) return NextResponse.json({ error: "Awards are not available." }, { status: 404 });
    const [teams, all] = await Promise.all([getTeams(), listSeasonAwards()]);
    // only the awards this parent has a ballot in: their own (parents'), or one per child (players')
    const awards = (await Promise.all(all.filter((award) => award.season === season && activeTeams.includes(award.team)).map(async (award) => {
      const slots = await Promise.all(awardSlotsFor(award, me.kids).map(async (slot) => ({
        ...(slot.playerId ? { forPlayer: { id: slot.playerId, name: slot.name ?? "" } } : {}),
        ballot: await ownAwardBallot(award.id, ballotField(me.userId, slot.playerId)),
      })));
      return slots.length ? { ...award, slots } : null;
    }))).filter((award) => award !== null);
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
    // the ballot this is: the parent's own, or a child of theirs in the award's team
    const forPlayer = typeof body.forPlayer === "string" && body.forPlayer ? body.forPlayer : undefined;
    const slot = awardSlotsFor(award, me.kids).find((s) => s.playerId === forPlayer);
    if (!slot) return NextResponse.json({ error: "You don't have a vote for this award." }, { status: 403 });
    const season = await getCurrentSeason();
    if (!(await activeAwardTeams(season)).includes(award.team)) return NextResponse.json({ error: "Awards are not available." }, { status: 404 });
    if (!award.open || award.season !== season) return NextResponse.json({ error: "Voting for this award is closed." }, { status: 409 });
    if (!validAwardChoices(body.choices, nomineesFor(award, slot.playerId).map((player) => player.id))) {
      return NextResponse.json({ error: slot.playerId ? "Choose one to three different players — not your own child." : "Choose one to three different players from this team's nominees." }, { status: 400 });
    }
    if (!(await submitAwardBallot(award.id, ballotField(me.userId, slot.playerId), season, body.choices, me.name))) return NextResponse.json({ error: "Voting has closed or awards are no longer available. Your ballot was not changed." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Your ballot could not be saved. Please try again later." }, { status: 503 });
  }
}
