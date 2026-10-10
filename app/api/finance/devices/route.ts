// Devices that open a team's Financial Admin with an account (lib/financeDevices.ts).
// For treasurers and club admins, signed in.
//   GET  ?team=                                     -> { me: { id, name }, devices }
//   POST { action: "register", team, id, publicKey, label, wrapped? }
//        a device asking to open the team; with `wrapped` (it was just unlocked with
//        the team password) it can straight away
//   POST { action: "approve", team, id, wrapped }    -> a waiting device can open the team
//   POST { action: "remove", team, id }              -> a device can't any more
import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_ID,
  cleanPublicKey,
  cleanWrapped,
  financeUser,
  getDevice,
  listDevices,
  removeDevice,
  saveDevice,
  type Wrapped,
} from "@/lib/financeDevices";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function context(team: unknown) {
  if (!(await getClub()).features.financialAdmin) return { error: "Financial Admin is off", status: 400 } as const;
  const tenant = await requireTenant();
  const user = await financeUser(tenant);
  if (!user) return { error: "Only treasurers and club admins can do this", status: 403 } as const;
  if (typeof team !== "string" || !(await isTeam(team))) return { error: "unknown team", status: 400 } as const;
  return { tenant, user, team };
}

export async function GET(req: NextRequest) {
  const ctx = await context(req.nextUrl.searchParams.get("team"));
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  return NextResponse.json({
    me: { id: ctx.user.id, name: ctx.user.name || ctx.user.email },
    devices: await listDevices(ctx.tenant, ctx.team),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ctx = await context(body?.team);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { tenant, user, team } = ctx;
  const id = typeof body?.id === "string" && DEVICE_ID.test(body.id) ? body.id : "";
  if (!id) return NextResponse.json({ error: "bad device" }, { status: 400 });
  const existing = await getDevice(tenant, team, id);
  const me = user.name || user.email;
  const now = new Date().toISOString();

  if (body?.action === "register") {
    const publicKey = cleanPublicKey(body.publicKey);
    if (!publicKey) return NextResponse.json({ error: "bad key" }, { status: 400 });
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: "device belongs to someone else" }, { status: 409 });
    }
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
    const wrapped = body.wrapped ? cleanWrapped(body.wrapped) : null;
    // the same device asking again keeps its approval (its key hasn't changed)
    const sameKey = existing && JSON.stringify(existing.publicKey) === JSON.stringify(publicKey);
    const approval: { wrapped?: Wrapped; approvedAt?: string; approvedBy?: string } = wrapped
      ? { wrapped, approvedAt: now, approvedBy: me }
      : sameKey && existing?.wrapped
        ? { wrapped: existing.wrapped, approvedAt: existing.approvedAt, approvedBy: existing.approvedBy }
        : {};
    await saveDevice(tenant, team, {
      id,
      userId: user.id,
      userName: me,
      label: label || "A device",
      publicKey,
      createdAt: existing?.createdAt ?? now,
      ...approval,
    });
  } else if (body?.action === "approve") {
    const wrapped = cleanWrapped(body.wrapped);
    if (!existing) return NextResponse.json({ error: "That device has gone" }, { status: 404 });
    if (!wrapped) return NextResponse.json({ error: "bad key" }, { status: 400 });
    await saveDevice(tenant, team, { ...existing, wrapped, approvedAt: now, approvedBy: me });
  } else if (body?.action === "remove") {
    await removeDevice(tenant, team, id);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ me: { id: user.id, name: me }, devices: await listDevices(tenant, team) });
}
