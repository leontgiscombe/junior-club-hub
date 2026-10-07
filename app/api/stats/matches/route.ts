// GET    /api/stats/matches?key=...           -> { matches: Match[] }
// POST   /api/stats/matches?key=...           -> add a match { team, opponent, date, home, friendly?, cup? }
// POST   /api/stats/matches?key=...           -> { action: "fa-sync", team, fixtures }
//          — add or update a team's fixtures from FA Full-Time (read from the
//            official code snippet in the coach's browser; see lib/faFullTime.ts)
// PATCH  /api/stats/matches?key=...           -> { matchId, action, ... }
//          action "edit"          { opponent?, date?, time?, home?, friendly?, cup? }
//                                 — change a fixture's details, leaving
//                                   everything logged against it alone
//          action "add-goal"      { scorerId, assistId? }
//          action "remove-goal"   { goalId }
//          action "opponent-goals"{ opponentGoals }
//          action "our-goals"     { ourGoals } — set our score directly, for a
//                                   result written up when nobody remembers
//                                   who scored; the difference is made up with
//                                   goals that have no scorer recorded
//          action "set-potm"      { playerId }  ("" clears)
//          action "set-most-improved" { playerId }  ("" clears)
//          action "set-appearances" { playerIds } — exactly who played
//          action "set-camera-holder" { holder } — who is filming (home games)
//          action "set-uploaded" { uploaded } — footage in the cloud yet
//          action "confirm-result" — mark the score final (a genuine 0-0)
// DELETE /api/stats/matches?key=...&id=...    -> remove a match
//
// Goal changes also adjust the season tallies, so the response returns the
// refreshed players alongside the match.
import { NextResponse } from "next/server";
import {
  addGoal,
  addMatch,
  confirmResult,
  deleteMatch,
  listMatches,
  removeGoal,
  setAppearances,
  setAward,
  setCameraHolder,
  setFootageUploaded,
  setOpponentGoals,
  setOurGoals,
  syncFaFixtures,
  updateMatch,
  type AwardField,
  type MatchDetails,
} from "@/lib/matchStorage";
import { listPlayers } from "@/lib/statsStorage";
import { checkAdminPassword } from "@/lib/adminAuth";
import { isValidTeam } from "@/lib/teams";
import { isValidHolder } from "@/lib/cameraHolders";
import type { FaFixture } from "@/lib/faFullTime";

export const runtime = "nodejs";

// The PATCH action that sets each per-game award.
const AWARD_ACTIONS: Record<string, AwardField> = {
  "set-potm": "potmId",
  "set-most-improved": "mostImprovedId",
};

function isAuthorised(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  return checkAdminPassword(key, process.env.ADMIN_KEY);
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const matches = await listMatches();
  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json();
  const team = String(body.team ?? "");
  if (body.action === "fa-sync") return faSync(team, body.fixtures);
  const opponent = String(body.opponent ?? "").trim();
  const date = String(body.date ?? "");
  const home = Boolean(body.home);
  const friendly = Boolean(body.friendly);
  // cup games are the non-league games that aren't friendlies
  const cup = friendly && Boolean(body.cup);
  const time = String(body.time ?? "");

  if (!isValidTeam(team)) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }
  if (!opponent || !date) {
    return NextResponse.json(
      { error: "Opponent and date are required" },
      { status: 400 }
    );
  }

  const { saved, match } = await addMatch({ team, opponent, date, time, home, friendly, cup });
  return NextResponse.json({ success: true, saved, match });
}

export async function PATCH(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json();
  const matchId = String(body.matchId ?? "");
  const action = String(body.action ?? "");

  if (!matchId) {
    return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  }

  let match = null;
  if (action === "edit") {
    const details: Partial<MatchDetails> = {};
    if ("opponent" in body) {
      const opponent = String(body.opponent ?? "").trim();
      if (!opponent) {
        return NextResponse.json({ error: "Opponent is required" }, { status: 400 });
      }
      details.opponent = opponent;
    }
    if ("date" in body) {
      const date = String(body.date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "A date is required" }, { status: 400 });
      }
      details.date = date;
    }
    if ("time" in body) {
      const time = String(body.time ?? "");
      if (time && !/^\d{2}:\d{2}$/.test(time)) {
        return NextResponse.json(
          { error: "Kick-off should look like 10:30" },
          { status: 400 }
        );
      }
      details.time = time;
    }
    if ("home" in body) details.home = Boolean(body.home);
    if ("friendly" in body) details.friendly = Boolean(body.friendly);
    if ("cup" in body) details.cup = Boolean(body.cup);
    match = await updateMatch(matchId, details);
  } else if (action === "add-goal") {
    const scorerId = String(body.scorerId ?? "");
    if (!scorerId) {
      return NextResponse.json({ error: "Pick who scored" }, { status: 400 });
    }
    const assistId = String(body.assistId ?? "");
    if (assistId && assistId === scorerId) {
      return NextResponse.json(
        { error: "A player cannot assist their own goal" },
        { status: 400 }
      );
    }
    match = await addGoal(matchId, scorerId, assistId);
  } else if (action === "remove-goal") {
    const goalId = String(body.goalId ?? "");
    if (!goalId) {
      return NextResponse.json({ error: "Missing goalId" }, { status: 400 });
    }
    match = await removeGoal(matchId, goalId);
  } else if (action === "opponent-goals") {
    match = await setOpponentGoals(matchId, body.opponentGoals);
  } else if (action === "our-goals") {
    const result = await setOurGoals(matchId, body.ourGoals);
    if (result === "below-credited") {
      return NextResponse.json(
        {
          error:
            "That is fewer goals than are already credited to players — remove one of those goals first.",
        },
        { status: 400 }
      );
    }
    match = result;
  } else if (action === "set-appearances") {
    const ids = Array.isArray(body.playerIds) ? body.playerIds.map(String) : [];
    match = await setAppearances(matchId, ids);
  } else if (action === "set-camera-holder") {
    const holder = String(body.holder ?? "");
    if (holder && !isValidHolder(holder)) {
      return NextResponse.json({ error: "Unknown holder" }, { status: 400 });
    }
    match = await setCameraHolder(matchId, holder);
  } else if (action === "set-uploaded") {
    match = await setFootageUploaded(matchId, Boolean(body.uploaded));
  } else if (action === "confirm-result") {
    match = await confirmResult(matchId);
  } else if (action in AWARD_ACTIONS) {
    const field = AWARD_ACTIONS[action];
    // "" clears the award
    match = await setAward(matchId, field, String(body.playerId ?? ""));
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  const players = await listPlayers();
  return NextResponse.json({ success: true, match, players });
}

export async function DELETE(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const removed = await deleteMatch(id);
  if (!removed) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  const players = await listPlayers();
  return NextResponse.json({ success: true, players });
}

/** Fixtures read from a team's Full-Time snippet, checked before they're stored. */
async function faSync(team: string, raw: unknown) {
  if (!isValidTeam(team)) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }
  const fixtures: FaFixture[] = (Array.isArray(raw) ? raw : [])
    .slice(0, 100)
    .map((f) => ({
      faId: String(f?.faId ?? ""),
      date: String(f?.date ?? ""),
      time: String(f?.time ?? ""),
      home: Boolean(f?.home),
      opponent: String(f?.opponent ?? "").trim().slice(0, 120),
      cup: Boolean(f?.cup),
    }))
    .filter(
      (f) =>
        /^\d{1,12}$/.test(f.faId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(f.date) &&
        (f.time === "" || /^\d{2}:\d{2}$/.test(f.time)) &&
        f.opponent
    );
  const result = await syncFaFixtures(team, fixtures);
  return NextResponse.json({ success: true, ...result });
}
