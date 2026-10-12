// A squad player's medical notes and emergency contact (lib/playerCare.ts),
// for one of their parents or carers (signed in) or a coach.
//   GET ?id=player[&key=]                        -> { care: { medical, emergency, updatedAt?, by? } }
//   PUT ?[key=] { id, medical, emergency }       -> { care }
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { currentPerson } from "@/lib/people";
import { getCare, saveCare } from "@/lib/playerCare";
import { isGuardianOf } from "@/lib/playerDevices";
import { listPlayers } from "@/lib/statsStorage";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Who's asking, if they may see `playerId`'s medical details. */
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

const noStore = { headers: { "cache-control": "no-store" } };

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const who = await allowed(req, id);
  if (!who) return NextResponse.json({ error: "Only the child's parents or a coach can see this" }, { status: 403 });
  return NextResponse.json({ care: await getCare(who.tenant, id) }, noStore);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const who = await allowed(req, id);
  if (!who) return NextResponse.json({ error: "Only the child's parents or a coach can change this" }, { status: 403 });
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const care = await saveCare(who.tenant, id, { medical: text(body?.medical), emergency: text(body?.emergency) }, who.by);
  return NextResponse.json({ care }, noStore);
}
