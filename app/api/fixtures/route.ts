// Fixtures, for coaches signed in with their own account (app/fixtures).
//   POST   { team, opponent, date, time?, meetTime?, home, type, venue?, address?, notes?, send? }
//          -> a new game in the match log; with send, it goes to the team's families
//   PATCH  { matchId, action, ... }
//          action "edit"     { opponent?, date?, time?, meetTime?, home?, type?, venue?, address?, notes?, tell? }
//                            — tell: families who've had it hear it's changed
//          action "send"     — to the team's families: they're asked who can play
//          action "remind"   — to the families still to answer
//          action "lineup"   { formation, slots } — coaches only ever see it; null slots clears it
//          action "score"    { ourGoals, opponentGoals } — the result, for everyone to see
//          action "call-off" { calledOff } — "postponed", "cancelled" or "" (back on)
//   DELETE ?id=…  -> remove the game (and what it credited, as the Match Log does)
import { NextResponse } from "next/server";
import {
  CALLED_OFF,
  addMatch,
  deleteMatch,
  getMatch,
  markSent,
  setCalledOff,
  setLineup,
  setOpponentGoals,
  setOurGoals,
  updateMatch,
  type CalledOff,
  type Match,
  type MatchDetails,
} from "@/lib/matchStorage";
import { canCoach, currentPerson, listPeople } from "@/lib/people";
import { getTeams, isTeam } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { familiesOf, lineupSlots, myPlayersIn, readReplies, squadOf } from "@/lib/fixtures";
import { notifyFixture } from "@/lib/notify";
import { FORMATIONS, teamFormat } from "@/lib/clubSettings";
import { fixtureWhen } from "@/lib/fixtureFormat";

export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

async function coach() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  return tenant && me?.person && canCoach(me.person) ? { tenant, person: me.person } : null;
}

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** The details in a request, checked; only the ones it has. */
function details(body: Record<string, unknown>): Partial<MatchDetails> | string {
  const d: Partial<MatchDetails> = {};
  if ("opponent" in body) {
    d.opponent = text(body.opponent, 120);
    if (!d.opponent) return "Who are you playing?";
  }
  if ("date" in body) {
    d.date = String(body.date ?? "");
    if (!DATE.test(d.date)) return "Pick the date";
  }
  for (const k of ["time", "meetTime"] as const) {
    if (k in body) {
      d[k] = String(body[k] ?? "");
      if (d[k] && !TIME.test(d[k]!)) return k === "time" ? "Kick-off should look like 10:30" : "Meet time should look like 09:45";
    }
  }
  if ("home" in body) d.home = Boolean(body.home);
  if ("type" in body) {
    const type = String(body.type);
    d.friendly = type === "friendly" || type === "cup";
    d.cup = type === "cup";
  }
  if ("venue" in body) d.venue = text(body.venue, 120);
  if ("address" in body) d.address = text(body.address, 300);
  if ("notes" in body) d.notes = text(body.notes, 2000);
  return d;
}

/** Tell the team's families about a game: everyone, or (a reminder) those still to answer. */
async function tell(tenant: string, match: Match, kind: "new" | "changed" | "reminder"): Promise<number> {
  const [people, teams, squad, replies] = await Promise.all([
    listPeople(tenant),
    getTeams(),
    squadOf(match.team),
    kind === "reminder" ? readReplies(match.id) : null,
  ]);
  let families = familiesOf(people, match.team);
  if (replies) families = families.filter((p) => myPlayersIn(p, squad).some((c) => !replies.players[c.playerId]));
  return notifyFixture(tenant, {
    id: match.id,
    teamName: teams.find((t) => t.slug === match.team)?.name ?? "Your team",
    opponent: match.opponent,
    when: fixtureWhen(match),
    kind,
    userIds: families.map((p) => p.userId),
  });
}

export async function POST(request: Request) {
  const me = await coach();
  if (!me) return bad("Only coaches can add fixtures", 403);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const team = String(body.team ?? "");
  if (!(await isTeam(team))) return bad("Pick the team");
  const d = details({ type: "league", ...body });
  if (typeof d === "string") return bad(d);
  if (!d.opponent || !d.date) return bad("Who you're playing and the date are needed");
  const { saved, match } = await addMatch({
    team,
    opponent: d.opponent,
    date: d.date,
    home: d.home ?? true,
    friendly: d.friendly ?? false,
    cup: d.cup,
    time: d.time,
    meetTime: d.meetTime,
    venue: d.venue,
    address: d.address,
    notes: d.notes,
  });
  if (!saved) return bad("Storage isn't set up", 503);
  let told = 0;
  if (body.send === true) {
    await markSent(match.id);
    told = await tell(me.tenant, match, "new");
  }
  return NextResponse.json({ success: true, match, told });
}

export async function PATCH(request: Request) {
  const me = await coach();
  if (!me) return bad("Only coaches can change fixtures", 403);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const match = await getMatch(String(body.matchId ?? ""));
  if (!match) return bad("That game isn't in the fixtures any more", 404);
  const action = String(body.action ?? "");

  if (action === "edit") {
    const d = details(body);
    if (typeof d === "string") return bad(d);
    const updated = await updateMatch(match.id, d);
    const told = updated && body.tell === true && updated.sentAt ? await tell(me.tenant, updated, "changed") : 0;
    return NextResponse.json({ success: true, match: updated, told });
  }
  if (action === "send") {
    const first = !match.sentAt;
    const updated = await markSent(match.id);
    const told = await tell(me.tenant, match, first ? "new" : "changed");
    return NextResponse.json({ success: true, match: updated, told });
  }
  if (action === "remind") {
    const told = await tell(me.tenant, match, "reminder");
    return NextResponse.json({ success: true, told });
  }
  if (action === "lineup") {
    if (body.slots === null) return NextResponse.json({ success: true, match: await setLineup(match.id, null) });
    const team = (await getTeams()).find((t) => t.slug === match.team);
    const formation = String(body.formation ?? "");
    if (!team || !FORMATIONS[teamFormat(team)].includes(formation)) return bad("Pick a formation");
    const squad = new Set((await squadOf(match.team)).map((p) => p.id));
    const size = lineupSlots(formation).length;
    const raw = Array.isArray(body.slots) ? body.slots.map(String) : [];
    const seen = new Set<string>();
    const slots = Array.from({ length: size }, (_, i) => {
      const id = raw[i] ?? "";
      if (!id || !squad.has(id) || seen.has(id)) return "";
      seen.add(id);
      return id;
    });
    return NextResponse.json({ success: true, match: await setLineup(match.id, { formation, slots }) });
  }
  if (action === "score") {
    const ours = Math.max(0, Math.min(99, Math.floor(Number(body.ourGoals))));
    const theirs = Math.max(0, Math.min(99, Math.floor(Number(body.opponentGoals))));
    if (!Number.isFinite(ours) || !Number.isFinite(theirs)) return bad("Enter both scores");
    const result = await setOurGoals(match.id, ours);
    if (result === "below-credited") {
      return bad("That's fewer goals than are already credited to scorers — take one off in the Match Log first.");
    }
    return NextResponse.json({ success: true, match: await setOpponentGoals(match.id, theirs) });
  }
  if (action === "call-off") {
    const calledOff = String(body.calledOff ?? "") as CalledOff;
    if (!CALLED_OFF.includes(calledOff)) return bad("Unknown option");
    const result = await setCalledOff(match.id, calledOff);
    if (result === "logged") return bad("This game already has a score logged — take that off first.");
    if (result && calledOff && result.sentAt) await tell(me.tenant, result, "changed");
    return NextResponse.json({ success: true, match: result });
  }
  return bad("Unknown action");
}

export async function DELETE(request: Request) {
  const me = await coach();
  if (!me) return bad("Only coaches can remove fixtures", 403);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!(await deleteMatch(id))) return bad("That game isn't in the fixtures any more", 404);
  return NextResponse.json({ success: true });
}
