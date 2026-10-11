import { NextResponse } from "next/server";
import { getSubmissions, deleteSubmission } from "@/lib/storage";
import { isCoach } from "@/lib/adminAuth";
import { isTeam } from "@/lib/settings";
import { listPlayers } from "@/lib/statsStorage";
import { deleteKitRequest, listKitRequests, setKitRequestDone, type KitRequest } from "@/lib/kitRequests";

export const runtime = "nodejs";

/** A kit request as coaches see it: without the parent's account id. */
function forCoaches(r: KitRequest): Omit<KitRequest, "userId"> {
  const shown: Partial<KitRequest> = { ...r };
  delete shown.userId;
  return shown as Omit<KitRequest, "userId">;
}

async function isAuthorised(request: Request): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  return isCoach(key);
}

export async function GET(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team") ?? "";
  if (!(await isTeam(team))) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }
  const [submissions, players, allRequests] = await Promise.all([getSubmissions(team), listPlayers(), listKitRequests()]);
  // kit asked for during the season (lib/kitRequests.ts); the parent's account id stays on the server
  const requests = allRequests.filter((r) => r.team === team).map(forCoaches);
  // The squad members with no kit sizes yet: matched by the player picked on the
  // form, or by name for answers typed in (and those sent before the list).
  const sent = new Set(submissions.map((x) => x.playerId).filter(Boolean));
  const sentNames = new Set(submissions.map((x) => x.childName.trim().toLowerCase()));
  const waiting = players
    .filter((pl) => pl.team === team)
    .filter((pl) => !sent.has(pl.id) && !sentNames.has(pl.name.trim().toLowerCase()))
    .map((pl) => pl.name)
    .sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ submissions, waiting, requests });
}

// PATCH ?key=… { requestId, done } -> marks a kit request sorted (or not); { requestId, remove: true } removes it
export async function PATCH(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const id = String(body.requestId ?? "");
  if (body.remove === true) {
    return (await deleteKitRequest(id))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "No such request" }, { status: 404 });
  }
  const updated = await setKitRequestDone(id, Boolean(body.done));
  if (!updated) return NextResponse.json({ error: "No such request" }, { status: 404 });
  return NextResponse.json({ success: true, request: forCoaches(updated) });
}

export async function DELETE(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team") ?? "";
  if (!(await isTeam(team))) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await deleteSubmission(team, id);
  return NextResponse.json({ success: true });
}
