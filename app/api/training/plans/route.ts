// GET  /api/training/plans?key=...  -> { drills, plans, ownerKeySet, coachesEditDrills, seasonPlans }
//        seasonPlans: the drill pack's season plan for each age band that has
//        one — { [band]: { title, weeks: [{ topic, drillIds }] in week order } }
// POST /api/training/plans?key=...  -> { action, ownerKey, ... }
//
// Any coach can read and change their team's plan with the coach password.
// The drill library — what each drill says — is the club's coaches' too,
// except on a single-club hub with TRAINING_PLANS_OWNER_KEY set: there adding,
// editing or deleting a drill also needs the owner's password.
//        action "check-owner"                  — just checks the owner password
//        action "save-drill"   { drill }       — add, or update by id
//        action "delete-drill" { id }          — also takes it out of every plan
//        action "add-file"     { drillId, label, data } — adds a photo or PDF
//                                               (data: a data: URL) to a drill
//        action "remove-file"  { drillId, fileId }
//        action "tick-drill"   { team, weekId, drillId, done } — tick a drill off
//                                               as done in a week (saved at once)
//        action "hide-from-players" { team, hidden } — hide the next session from
//                                               the team's players and families (saved at once)
//        action "save-plan"    { team, plan }  — replaces that team's plan; its
//                                               startDate must be a training Monday
import { NextResponse } from "next/server";
import {
  UPLOAD_LIMITS,
  addDrillUpload,
  deleteDrill,
  removeDrillUpload,
  isBuiltInDrill,
  listDrills,
  listPlans,
  saveDrill,
  savePlan,
  setHiddenFromPlayers,
  tickDrill,
} from "@/lib/trainingPlans";
import { checkPlansOwnerKey, drillsNeedOwnerKey, isCoach } from "@/lib/adminAuth";
import { isTeam } from "@/lib/settings";
import { atLimit, overLimit } from "@/lib/rateLimit";
import { isTrainingDate } from "@/lib/trainingStorage";
import { SEASON_PLANS } from "@/lib/builtInDrills";

export const runtime = "nodejs";

async function isAuthorised(request: Request): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  return isCoach(key);
}

export async function GET(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const [drills, plans, needOwner] = await Promise.all([listDrills(), listPlans(), drillsNeedOwnerKey()]);
  return NextResponse.json({
    drills,
    plans,
    ownerKeySet: needOwner,
    // with no owner password in play, the club's coaches edit the drills
    coachesEditDrills: !needOwner,
    seasonPlans: SEASON_PLANS,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const ownerOnly = ["check-owner", "save-drill", "delete-drill", "add-file", "remove-file"].includes(body.action);
  if (ownerOnly && (await drillsNeedOwnerKey())) {
    // wrong owner passwords are counted, so it can't be guessed
    if (await atLimit("drill-owner", 10)) {
      return NextResponse.json({ error: "Too many wrong passwords — try again in an hour" }, { status: 429 });
    }
    if (!checkPlansOwnerKey(String(body.ownerKey ?? ""))) {
      await overLimit("drill-owner", 10, 3600);
      return NextResponse.json(
        { error: "Only the owner can change the drill library" },
        { status: 403 }
      );
    }
  }
  if (body.action === "check-owner") return NextResponse.json({ success: true });

  if (body.action === "save-drill") {
    const drill = body.drill ?? {};
    if (!String(drill.title ?? "").trim()) {
      return NextResponse.json({ error: "Give the drill a name" }, { status: 400 });
    }
    return NextResponse.json({ success: true, drill: await saveDrill(drill) });
  }

  if (body.action === "delete-drill") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "No drill given" }, { status: 400 });
    if (isBuiltInDrill(id)) {
      return NextResponse.json({ error: "That drill comes with the app" }, { status: 400 });
    }
    return NextResponse.json({ success: true, plans: await deleteDrill(id) });
  }

  if (body.action === "add-file") {
    const match = typeof body.data === "string" ? /^data:([\w/+.-]+);base64,(.+)$/.exec(body.data) : null;
    const mime = match?.[1] ?? "";
    const type = (UPLOAD_LIMITS.pdf.types as readonly string[]).includes(mime)
      ? "pdf"
      : (UPLOAD_LIMITS.image.types as readonly string[]).includes(mime)
        ? "image"
        : null;
    if (!match || !type) {
      return NextResponse.json({ error: "Add a photo (JPEG, PNG or WebP) or a PDF" }, { status: 400 });
    }
    if (Buffer.byteLength(match[2], "base64") > UPLOAD_LIMITS[type].bytes) {
      return NextResponse.json(
        { error: type === "pdf" ? "That PDF is over 1 MB — try a smaller one" : "That photo is too big — try a smaller one" },
        { status: 400 }
      );
    }
    try {
      const drill = await addDrillUpload(String(body.drillId ?? ""), {
        label: String(body.label ?? ""),
        type,
        mime,
        data: match[2],
      });
      return NextResponse.json({ success: true, drill });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "That didn't save" }, { status: 400 });
    }
  }

  if (body.action === "remove-file") {
    try {
      const drill = await removeDrillUpload(String(body.drillId ?? ""), String(body.fileId ?? ""));
      return NextResponse.json({ success: true, drill });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "That didn't save" }, { status: 400 });
    }
  }

  if (body.action === "tick-drill") {
    const team = String(body.team ?? "");
    if (!(await isTeam(team))) {
      return NextResponse.json({ error: "Unknown team" }, { status: 400 });
    }
    const plan = await tickDrill(
      team,
      String(body.weekId ?? ""),
      String(body.drillId ?? ""),
      Boolean(body.done)
    );
    if (!plan) {
      return NextResponse.json({ error: "Save the plan first, then tick it off" }, { status: 400 });
    }
    return NextResponse.json({ success: true, plan });
  }

  if (body.action === "hide-from-players") {
    const team = String(body.team ?? "");
    if (!(await isTeam(team))) {
      return NextResponse.json({ error: "Unknown team" }, { status: 400 });
    }
    const plan = await setHiddenFromPlayers(team, Boolean(body.hidden));
    if (!plan) return NextResponse.json({ error: "Unknown team" }, { status: 400 });
    return NextResponse.json({ success: true, plan });
  }

  if (body.action === "save-plan") {
    const team = String(body.team ?? "");
    if (!(await isTeam(team))) {
      return NextResponse.json({ error: "Unknown team" }, { status: 400 });
    }
    const startDate = String(body.plan?.startDate ?? "");
    if (startDate && !(await isTrainingDate(team, startDate))) {
      return NextResponse.json({ error: "Start the plan on one of the team's training days" }, { status: 400 });
    }
    return NextResponse.json({ success: true, plan: await savePlan(team, body.plan ?? {}) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
