import { NextResponse } from "next/server";
import { SESSION_KEY } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { getTeams } from "@/lib/settings";
import { getCurrentSeason } from "@/lib/season";
import { listPlayers } from "@/lib/statsStorage";
import { AWARD_VOTERS, STARTER_AWARDS, awardStandings, guessVoters, votersOf, type AwardVoters, type SeasonAward } from "@/lib/seasonAwards";
import { activeAwardTeams, awardBallots, getSeasonAward, listSeasonAwards, removeSeasonAward, saveSeasonAward, setAwardsActive } from "@/lib/seasonAwardsStorage";
import { requireTenant } from "@/lib/tenant";
import { notifyAwardsActivated } from "@/lib/notify";

export const runtime = "nodejs";

// a team's squad, as an award's nominees
async function squad(team: string) {
  return (await listPlayers()).filter((player) => player.team === team).map(({ id, name }) => ({ id, name }));
}

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Add awards to a team's current season in one go (the usual ones, or last
 * season's), voting closed, skipping any it has by that name already.
 */
async function addAwards(team: string, list: { title: string; description: string; voters?: AwardVoters }[]) {
  if (!(await getTeams()).some((t) => t.slug === team)) return NextResponse.json({ error: "Choose a team." }, { status: 400 });
  const nominees = await squad(team);
  if (!nominees.length) return NextResponse.json({ error: "Add players to this team's squad before creating an award." }, { status: 400 });
  const season = await getCurrentSeason();
  const have = (await listSeasonAwards()).filter((a) => a.team === team && a.season === season);
  const fresh = list.filter((x, i) => !have.some((a) => sameTitle(a.title, x.title)) && list.findIndex((y) => sameTitle(y.title, x.title)) === i);
  for (const x of fresh) {
    await saveSeasonAward({ id: crypto.randomUUID(), team, season, title: x.title, description: x.description, open: false, nominees, voters: x.voters ?? guessVoters(x.title) });
  }
  return NextResponse.json({ success: true, added: fresh.length });
}

async function authorised(request: Request) {
  return isCoach(request.headers.get("x-coach-key") || SESSION_KEY);
}

export async function GET(request: Request) {
  try {
    if (!(await authorised(request))) return NextResponse.json({ error: "Coach access is required." }, { status: 401 });
    const [season, teams, all] = await Promise.all([getCurrentSeason(), getTeams(), listSeasonAwards()]);
    const activeTeams = await activeAwardTeams(season);
    const awards = await Promise.all(all.map(async (award) => {
      const ballots = await awardBallots(award.id);
      return { ...award, ballotCount: ballots.length, standings: awardStandings(ballots) };
    }));
    return NextResponse.json({ season, activeTeams, teams: teams.map(({ slug, name }) => ({ slug, name })), awards }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Awards could not be loaded. Please try again later." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await authorised(request))) return NextResponse.json({ error: "Coach access is required." }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Send an award." }, { status: 400 });
    if (body.action === "activate") {
      const team = (await getTeams()).find((team) => team.slug === body.team);
      if (typeof body.active !== "boolean" || !team) {
        return NextResponse.json({ error: "Choose a team and activation status." }, { status: 400 });
      }
      const tenant = await requireTenant();
      const season = await getCurrentSeason();
      const activated = await setAwardsActive(season, team.slug, body.active);
      if (activated) await notifyAwardsActivated(tenant, { team: team.slug, teamName: team.name, season });
      return NextResponse.json({ success: true });
    }
    if (body.action === "delete") {
      if (typeof body.id !== "string" || !(await getSeasonAward(body.id))) return NextResponse.json({ error: "Award not found." }, { status: 404 });
      await removeSeasonAward(body.id);
      return NextResponse.json({ success: true });
    }
    if (body.action === "starter") {
      // the usual awards the coach ticked
      if (typeof body.team !== "string" || !Array.isArray(body.titles) || !body.titles.length) return NextResponse.json({ error: "Choose at least one award." }, { status: 400 });
      const chosen = STARTER_AWARDS.filter((s) => body.titles.includes(s.title));
      if (chosen.length !== body.titles.length) return NextResponse.json({ error: "Choose from the usual awards." }, { status: 400 });
      return addAwards(body.team, chosen);
    }
    if (body.action === "copy") {
      // the most recent other season this team had awards in ("2025/26" sorts before "2026/27")
      if (typeof body.team !== "string") return NextResponse.json({ error: "Choose a team." }, { status: 400 });
      const season = await getCurrentSeason();
      const earlier = (await listSeasonAwards()).filter((a) => a.team === body.team && a.season !== season);
      const last = earlier.map((a) => a.season).sort().at(-1);
      if (!last) return NextResponse.json({ error: "This team has no awards from an earlier season." }, { status: 404 });
      return addAwards(body.team, earlier.filter((a) => a.season === last).map((a) => ({ title: a.title, description: a.description, voters: votersOf(a) })));
    }
    if (body.action !== "save") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const raw = body.award;
    if (!raw || typeof raw.title !== "string" || !raw.title.trim() || raw.title.trim().length > 100 || typeof raw.description !== "string" || raw.description.length > 500 || typeof raw.open !== "boolean") {
      return NextResponse.json({ error: "Enter an award name (up to 100 characters), description (up to 500) and voting status." }, { status: 400 });
    }
    if (raw.id !== undefined && (typeof raw.id !== "string" || !raw.id)) return NextResponse.json({ error: "Invalid award." }, { status: 400 });
    if (raw.voters !== undefined && !AWARD_VOTERS.includes(raw.voters)) return NextResponse.json({ error: "Choose who votes." }, { status: 400 });
    const existing = raw.id ? await getSeasonAward(raw.id) : null;
    if (raw.id && !existing) return NextResponse.json({ error: "Award not found." }, { status: 404 });
    const season = await getCurrentSeason();
    if (existing && existing.season !== season && raw.open) return NextResponse.json({ error: "Awards from past seasons cannot be reopened." }, { status: 400 });
    let award: SeasonAward;
    if (existing) {
      const voters: AwardVoters = raw.voters ?? votersOf(existing);
      // the ballots in already were cast as one kind of voter: who votes stays put
      if (voters !== votersOf(existing) && (await awardBallots(existing.id)).length) {
        return NextResponse.json({ error: "Ballots are already in, so who votes can't change. Delete the award and add it again to change it." }, { status: 409 });
      }
      award = { ...existing, title: raw.title.trim(), description: raw.description.trim(), open: raw.open, voters };
    } else {
      const teams = await getTeams();
      if (!teams.some((team) => team.slug === raw.team)) return NextResponse.json({ error: "Choose a team." }, { status: 400 });
      const nominees = await squad(raw.team);
      if (!nominees.length) return NextResponse.json({ error: "Add players to this team's squad before creating an award." }, { status: 400 });
      award = { id: crypto.randomUUID(), team: raw.team, season, title: raw.title.trim(), description: raw.description.trim(), open: raw.open, nominees, voters: raw.voters ?? guessVoters(raw.title) };
    }
    await saveSeasonAward(award);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "The award could not be saved. Please try again later." }, { status: 503 });
  }
}