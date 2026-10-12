// "Set up your club" (lib/setupChecklist.ts), for the club's admins.
//   POST { action: "tick" | "untick", step } -> a step that's about checking something, ticked by hand
//   POST { action: "hide" | "show" }        -> the card, hidden (or shown again) for this admin
import { NextRequest, NextResponse } from "next/server";
import { currentPerson } from "@/lib/people";
import { MANUAL_STEPS, changeSetup } from "@/lib/setupChecklist";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  if (!tenant || !me?.person || me.person.status !== "approved" || !me.person.roles.includes("admin")) {
    return NextResponse.json({ error: "Only the club's admins can do this" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  const step = typeof body?.step === "string" ? body.step : "";
  if ((action === "tick" || action === "untick") && (MANUAL_STEPS as readonly string[]).includes(step)) {
    await changeSetup(tenant, me.user.id, action, step);
  } else if (action === "hide" || action === "show") {
    await changeSetup(tenant, me.user.id, action);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
