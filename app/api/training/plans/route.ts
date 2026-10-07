// GET  /api/training/plans?key=...  -> { drills, plans, ownerKeySet, seasonPlan, seasonPlanTitle }
//        seasonPlan: the drill pack's season plan — [{ topic, drillIds }] in week order
//        seasonPlanTitle: the title it gives a plan
// POST /api/training/plans?key=...  -> { action, ownerKey, ... }
//
// Any coach can read and change their team's plan with the admin password,
// but the drill library — what each drill says — is the owner's: adding,
// editing or deleting a drill also needs the owner's password
// (TRAINING_PLANS_OWNER_KEY).
//        action "check-owner"                  — just checks the owner password
//        action "save-drill"   { drill }       — add, or update by id
//        action "delete-drill" { id }          — also takes it out of every plan
//        action "tick-drill"   { team, weekId, drillId, done } — tick a drill off
//                                               as done in a week (saved at once)
//        action "save-plan"    { team, plan }  — replaces that team's plan; its
//                                               startDate must be a training Monday
import { NextResponse } from "next/server";
import {
  deleteDrill,
  isBuiltInDrill,
  listDrills,
  listPlans,
  saveDrill,
  savePlan,
  tickDrill,
} from "@/lib/trainingPlans";
import { checkAdminPassword, checkPlansOwnerKey, isPlansOwnerKeySet } from "@/lib/adminAuth";
import { isValidTeam } from "@/lib/teams";
import { isTrainingDate } from "@/lib/trainingStorage";
import { SEASON_PLAN } from "@/lib/builtInDrills";

export const runtime = "nodejs";

function isAuthorised(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";
  return checkAdminPassword(key, process.env.ADMIN_KEY);
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const [drills, plans] = await Promise.all([listDrills(), listPlans()]);
  return NextResponse.json({
    drills,
    plans,
    ownerKeySet: isPlansOwnerKeySet(),
    seasonPlan: SEASON_PLAN.weeks,
    seasonPlanTitle: SEASON_PLAN.title,
  });
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const ownerOnly = ["check-owner", "save-drill", "delete-drill"].includes(body.action);
  if (ownerOnly && !checkPlansOwnerKey(String(body.ownerKey ?? ""))) {
    return NextResponse.json(
      { error: "Only the owner can change the drill library" },
      { status: 403 }
    );
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

  if (body.action === "tick-drill") {
    const team = String(body.team ?? "");
    if (!isValidTeam(team)) {
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

  if (body.action === "save-plan") {
    const team = String(body.team ?? "");
    if (!isValidTeam(team)) {
      return NextResponse.json({ error: "Unknown team" }, { status: 400 });
    }
    const startDate = String(body.plan?.startDate ?? "");
    if (startDate && !isTrainingDate(startDate)) {
      return NextResponse.json({ error: "Start the plan on a training Monday" }, { status: 400 });
    }
    return NextResponse.json({ success: true, plan: await savePlan(team, body.plan ?? {}) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
