// A child's own devices (lib/playerDevices.ts), for one of their parents or
// carers (signed in) or a coach.
//   GET ?id=player[&key=]               -> { devices }
//   POST ?[key=] { id }                 -> { code, minutes }: a one-time code to set one up
//   DELETE ?id=player&device=id[&key=]  -> { ok }: signs that device out
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { currentPerson } from "@/lib/people";
import { CODE_MINUTES, isGuardianOf, listPlayerDevices, newPlayerCode, removePlayerDevice } from "@/lib/playerDevices";
import { overLimit } from "@/lib/rateLimit";
import { listPlayers } from "@/lib/statsStorage";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Who's asking, if they may look after `playerId`'s devices. */
async function allowed(req: NextRequest, playerId: string): Promise<{ tenant: string; by: string } | null> {
  const tenant = await getTenant();
  if (!tenant || !playerId) return null;
  if (!(await listPlayers()).some((p) => p.id === playerId)) return null;
  const me = await currentPerson(tenant).catch(() => null);
  if (isGuardianOf(me?.person ?? null, playerId)) return { tenant, by: me!.person!.name || "A parent" };
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (key && (await isCoach(key))) return { tenant, by: me?.person?.name || "A coach" };
  return null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const who = await allowed(req, id);
  if (!who) return NextResponse.json({ error: "Only the child's parents or a coach can see this" }, { status: 403 });
  return NextResponse.json({ devices: await listPlayerDevices(who.tenant, id) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const who = await allowed(req, id);
  if (!who) return NextResponse.json({ error: "Only the child's parents or a coach can do this" }, { status: 403 });
  if (await overLimit("player-code", 20, 3600)) {
    return NextResponse.json({ error: "That's a lot of codes — try again later" }, { status: 429 });
  }
  return NextResponse.json({ code: await newPlayerCode(who.tenant, id, who.by), minutes: CODE_MINUTES });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const who = await allowed(req, id);
  if (!who) return NextResponse.json({ error: "Only the child's parents or a coach can do this" }, { status: 403 });
  const ok = await removePlayerDevice(who.tenant, id, req.nextUrl.searchParams.get("device") ?? "");
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "That device isn't set up any more" }, { status: 404 });
}
