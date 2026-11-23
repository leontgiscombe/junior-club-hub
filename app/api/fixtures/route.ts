// Fixtures, for coaches signed in with their own account (app/fixtures).
//   POST   { team, type, competition?, opponent, date, time?, meetTime?, venue?, address?, notes?, invited?, deadline?, send? }
//          type "home" | "away" | "tournament" | "training"; competition "league" | "cup" | "friendly";
//          invited: squad player ids (null or left out: the whole squad); deadline "YYYY-MM-DDTHH:MM"
//          -> a new game in the match log; with send, it goes to the team's families
//   PATCH  { matchId, action, ... }
//          action "edit"     { any of the above but team, tell? }
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
  anythingLogged,
  listMatches,
  type CalledOff,
  type Match,
  type MatchDetails,
} from "@/lib/matchStorage";
import { canCoach, currentPerson, listPeople } from "@/lib/people";
import { getTeams, isTeam } from "@/lib/settings";
import { getTenant, requireTenant } from "@/lib/tenant";
import { isCoachPerson, lineupSlots, squadOf } from "@/lib/fixtures";
import { tellFamilies as tell } from "@/lib/fixtureAlerts";
import { FORMATIONS, teamFormat } from "@/lib/clubSettings";
import { isKitColour } from "@/lib/kitColours";

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

/**
 * The details in a request, checked; only the ones it has. `type` is what the
 * coach picked — "home", "away", "tournament" or "training" — and, for a home
 * or away match, `competition` "league", "cup" or "friendly".
 */
async function details(body: Record<string, unknown>, team: string): Promise<Partial<MatchDetails> | string> {
  const d: Partial<MatchDetails> = {};
  if ("opponent" in body) {
    d.opponent = text(body.opponent, 120);
    if (!d.opponent) return body.type === "tournament" ? "What's the tournament called?" : "Who are you playing?";
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
  if ("type" in body) {
    const type = String(body.type);
    if (type === "tournament" || type === "training") {
      d.kind = type;
      d.friendly = true;
      d.cup = false;
      if ("home" in body) d.home = Boolean(body.home);
    } else if (type === "home" || type === "away") {
      d.kind = "";
      d.home = type === "home";
      const competition = String(body.competition ?? "league");
      d.friendly = competition === "friendly" || competition === "cup";
      d.cup = competition === "cup";
    } else return "Pick what sort of game it is";
  }
  for (const k of ["ourKit", "theirKit"] as const) {
    if (k in body) {
      const c = String(body[k] ?? "");
      if (c && !isKitColour(c)) return "Pick a kit colour";
      d[k] = c;
    }
  }
  if ("venue" in body) d.venue = text(body.venue, 120);
  if ("address" in body) d.address = text(body.address, 300);
  if ("notes" in body) d.notes = text(body.notes, 2000);
  if ("deadline" in body) {
    d.deadline = String(body.deadline ?? "");
    if (d.deadline && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.deadline)) return "Pick a reply-by date and time";
  }
  if ("invited" in body) {
    if (body.invited === null) d.invited = null;
    else {
      const squad = new Set((await squadOf(team)).map((p) => p.id));
      const picked = (Array.isArray(body.invited) ? body.invited.map(String) : []).filter((id: string) => squad.has(id));
      if (!picked.length) return "Pick at least one player";
      d.invited = [...new Set(picked)];
    }
  }
  if ("hosts" in body) {
    if (body.hosts === null) d.hosts = null;
    else {
      // only the club's coaches and admins can host
      const coaches = new Set((await listPeople(await requireTenant())).filter(isCoachPerson).map((p) => p.userId));
      d.hosts = [...new Set((Array.isArray(body.hosts) ? body.hosts.map(String) : []).filter((id: string) => coaches.has(id)))];
    }
  }
  return d;
}

const MAX_REPEATS = 26;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dayGap = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
/** A reply-by time set against one game, moved to the same distance from another. */
const shiftDeadline = (deadline: string, from: string, to: string) =>
  deadline ? `${addDays(deadline.slice(0, 10), dayGap(from, to))}${deadline.slice(10)}` : "";

/** The games after `match` in its series that haven't been played. */
async function laterInSeries(match: Match): Promise<Match[]> {
  return (await listMatches()).filter((g) => g.seriesId === match.seriesId && g.id !== match.id && g.date > match.date && !g.resultLogged);
}

export async function POST(request: Request) {
  const me = await coach();
  if (!me) return bad("Only coaches can add fixtures", 403);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const team = String(body.team ?? "");
  if (!(await isTeam(team))) return bad("Pick the team");
  const d = await details({ type: "home", ...body }, team);
  if (typeof d === "string") return bad(d);
  if (!d.opponent || !d.date) return bad(d.kind === "tournament" ? "The tournament's name and date are needed" : "Who you're playing and the date are needed");
  // repeating: the same game every week or two, as separate games in a series
  const every = Number((body.repeat as { every?: unknown } | undefined)?.every);
  const times = Math.floor(Number((body.repeat as { times?: unknown } | undefined)?.times));
  const repeat = (every === 1 || every === 2) && times >= 2 ? Math.min(times, MAX_REPEATS) : 1;
  const seriesId = repeat > 1 ? crypto.randomUUID() : "";
  const games: Match[] = [];
  for (let i = 0; i < repeat; i++) {
    const shift = i * 7 * (every || 1);
    const { saved, match } = await addMatch({
      team,
      opponent: d.opponent,
      date: addDays(d.date, shift),
      home: d.home ?? true,
      friendly: d.friendly ?? false,
      cup: d.cup,
      time: d.time,
      meetTime: d.meetTime,
      venue: d.venue,
      address: d.address,
      notes: d.notes,
      kind: d.kind,
      invited: d.invited ?? null,
      hosts: d.hosts ?? null,
      // the reply-by time keeps its distance from each game
      deadline: d.deadline ? `${addDays(d.deadline.slice(0, 10), shift)}${d.deadline.slice(10)}` : "",
      ourKit: d.ourKit,
      theirKit: d.theirKit,
      seriesId,
    });
    if (!saved) return bad("Storage isn't set up", 503);
    games.push(match);
  }
  let told = 0;
  if (body.send === true) {
    for (const g of games) await markSent(g.id);
    // one alert for a whole series, not one per game
    told = await tell(me.tenant, games[0], "new", games.length > 1 ? { count: games.length, every: every as 1 | 2 } : undefined, me.person.userId);
  }
  return NextResponse.json({ success: true, match: games[0], games: games.length, told });
}

export async function PATCH(request: Request) {
  const me = await coach();
  if (!me) return bad("Only coaches can change fixtures", 403);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const match = await getMatch(String(body.matchId ?? ""));
  if (!match) return bad("That game isn't in the fixtures any more", 404);
  const action = String(body.action ?? "");

  if (action === "edit") {
    const d = await details(body, match.team);
    if (typeof d === "string") return bad(d);
    const updated = await updateMatch(match.id, d);
    let told = updated && body.tell === true && updated.sentAt ? await tell(me.tenant, updated, "changed", undefined, me.person.userId) : 0;
    // "this and later games": everything but the date (each keeps its own day)
    let others = 0;
    if (body.series === true && match.seriesId) {
      const rest = { ...d };
      delete rest.date;
      delete rest.deadline;
      for (const g of await laterInSeries(match)) {
        // a reply-by time keeps the same distance from each game as from this one
        const deadline = d.deadline !== undefined ? shiftDeadline(d.deadline, match.date, g.date) : undefined;
        const next = await updateMatch(g.id, { ...rest, ...(deadline !== undefined ? { deadline } : {}) });
        others++;
        if (next && body.tell === true && next.sentAt) told = Math.max(told, await tell(me.tenant, next, "changed", undefined, me.person.userId));
      }
    }
    return NextResponse.json({ success: true, match: updated, told, others });
  }
  if (action === "send") {
    const first = !match.sentAt;
    const updated = await markSent(match.id);
    const told = await tell(me.tenant, match, first ? "new" : "changed", undefined, me.person.userId);
    return NextResponse.json({ success: true, match: updated, told });
  }
  if (action === "remind") {
    const told = await tell(me.tenant, match, "reminder", undefined, me.person.userId);
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
    if (result && calledOff && result.sentAt) await tell(me.tenant, result, "changed", undefined, me.person.userId);
    return NextResponse.json({ success: true, match: result });
  }
  return bad("Unknown action");
}

export async function DELETE(request: Request) {
  const me = await coach();
  if (!me) return bad("Only coaches can remove fixtures", 403);
  const params = new URL(request.url).searchParams;
  const match = await getMatch(params.get("id") ?? "");
  if (!match) return bad("That game isn't in the fixtures any more", 404);
  // "this and later games in the series": the later ones go if nothing's logged against them
  const later = params.get("series") === "1" && match.seriesId ? (await laterInSeries(match)).filter((g) => !anythingLogged(g)) : [];
  await deleteMatch(match.id);
  for (const g of later) await deleteMatch(g.id);
  return NextResponse.json({ success: true, removed: 1 + later.length });
}
