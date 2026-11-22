// Answering a fixture (app/fixtures/[id]).
//   POST { matchId, playerId, answer, note? } — a parent, for their own child
//        (or a coach, for any player in the squad); answer "yes", "no", or null
//        to take it back
//   POST { matchId, host: true, answer }      — a coach, whether they can host it
import { NextResponse } from "next/server";
import { getMatch } from "@/lib/matchStorage";
import { canCoach, currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";
import { deadlinePassed, invitedOf, myPlayersIn, saveReply, squadOf, type Answer } from "@/lib/fixtures";

export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  const person = me?.person?.status === "approved" ? me.person : null;
  if (!person) return bad("Sign in with your account to answer", 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const match = await getMatch(String(body.matchId ?? ""));
  if (!match) return bad("That game isn't in the fixtures any more", 404);
  if (match.calledOff === "cancelled") return bad("This game has been cancelled");
  const answer = body.answer === "yes" || body.answer === "no" ? (body.answer as Answer) : body.answer === null ? null : undefined;
  if (answer === undefined) return bad("Say whether they can play");
  const note = answer === "no" ? String(body.note ?? "").trim().slice(0, 200) : "";
  const reply = answer ? { answer, ...(note ? { note } : {}), by: person.name, byUserId: person.userId, at: new Date().toISOString() } : null;

  if (body.host === true) {
    if (!canCoach(person)) return bad("Only coaches host games", 403);
    await saveReply(match.id, { kind: "h", id: person.userId }, reply);
    return NextResponse.json({ success: true });
  }

  const playerId = String(body.playerId ?? "");
  const squad = invitedOf(await squadOf(match.team), match);
  if (!squad.some((p) => p.id === playerId)) return bad("That player isn't invited to this game");
  const coach = canCoach(person);
  const mine = myPlayersIn(person, squad).some((c) => c.playerId === playerId);
  if (!mine && !coach) return bad("You can only answer for your own children", 403);
  // after the reply-by time, a family asks the coaches, who can still change it
  if (!coach && deadlinePassed(match)) return bad("The reply-by time has passed — message the coaches to change your answer");
  await saveReply(match.id, { kind: "p", id: playerId }, reply);
  return NextResponse.json({ success: true });
}
