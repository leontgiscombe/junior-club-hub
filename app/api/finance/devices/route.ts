// Devices that open a team's Financial Admin with an account (lib/financeDevices.ts).
// For treasurers and club admins, signed in.
//   GET  ?team=                                     -> { me: { id, name }, devices }
//   POST { action: "register", team, id, publicKey, label, wrapped? }
//        a device asking to open the team; with `wrapped` (it was just unlocked with
//        the team password) it can straight away
//   POST { action: "approve", team, id, wrapped }    -> a waiting device can open the team
//   POST { action: "passkey", team, credId, wrapped } -> one of your passkeys can open the team
//   POST { action: "remove", team, id }              -> a device (or passkey) can't any more
// GET also says which passkeys you have, and the passkeys' rpId, for the browser.
import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_ID,
  cleanPasskeyWrapped,
  cleanPublicKey,
  cleanWrapped,
  financeUser,
  getDevice,
  listDevices,
  passkeyEntryId,
  removeDevice,
  saveDevice,
  type PasskeyWrapped,
  type Wrapped,
} from "@/lib/financeDevices";
import { getPasskey, listPasskeys, relyingParty } from "@/lib/passkeys";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function context(team: unknown) {
  if (!(await getClub()).features.financialAdmin) return { error: "Finances is switched off", status: 400 } as const;
  const tenant = await requireTenant();
  if (typeof team !== "string" || !(await isTeam(team))) return { error: "unknown team", status: 400 } as const;
  // a treasurer with a team of their own opens just that one with their account
  const user = await financeUser(tenant, team);
  if (!user) return { error: "Only this team's treasurer or a club admin can do this", status: 403 } as const;
  return { tenant, user, team };
}

/** The team's devices, leaving out passkeys their owner has since removed from their account. */
async function devicesOf(tenant: string, team: string) {
  const all = await listDevices(tenant, team);
  const live = await Promise.all(all.map((d) => (d.kind === "passkey" && d.credId ? getPasskey(d.userId, d.credId).then(Boolean) : true)));
  return all.filter((_, i) => live[i]);
}

async function reply(req: NextRequest, ctx: { tenant: string; user: { id: string; name: string; email: string }; team: string }) {
  return NextResponse.json({
    me: { id: ctx.user.id, name: ctx.user.name || ctx.user.email },
    devices: await devicesOf(ctx.tenant, ctx.team),
    rpId: relyingParty(req).rpID,
    passkeys: (await listPasskeys(ctx.user.id)).map((k) => ({ id: k.id, label: k.label, prf: k.prf ?? null })),
  });
}

export async function GET(req: NextRequest) {
  const ctx = await context(req.nextUrl.searchParams.get("team"));
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  return reply(req, ctx);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ctx = await context(body?.team);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { tenant, user, team } = ctx;
  const me = user.name || user.email;
  const now = new Date().toISOString();

  if (body?.action === "passkey") {
    const key = typeof body.credId === "string" ? await getPasskey(user.id, body.credId) : null;
    if (!key) return NextResponse.json({ error: "That passkey isn't on your account" }, { status: 400 });
    const wrapped = cleanPasskeyWrapped(body.wrapped);
    if (!wrapped) return NextResponse.json({ error: "bad key" }, { status: 400 });
    const id = passkeyEntryId(key.id);
    const existing = await getDevice(tenant, team, id);
    await saveDevice(tenant, team, {
      id,
      kind: "passkey",
      credId: key.id,
      userId: user.id,
      userName: me,
      label: `Passkey · ${key.label}`,
      wrapped,
      createdAt: existing?.createdAt ?? now,
      approvedAt: now,
      approvedBy: me,
    });
    return reply(req, ctx);
  }

  const id = typeof body?.id === "string" && DEVICE_ID.test(body.id) ? body.id : "";
  if (!id) return NextResponse.json({ error: "bad device" }, { status: 400 });
  const existing = await getDevice(tenant, team, id);

  if (body?.action === "register") {
    const publicKey = cleanPublicKey(body.publicKey);
    if (!publicKey) return NextResponse.json({ error: "bad key" }, { status: 400 });
    if (existing && (existing.userId !== user.id || existing.kind === "passkey")) {
      return NextResponse.json({ error: "device belongs to someone else" }, { status: 409 });
    }
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
    const wrapped = body.wrapped ? cleanWrapped(body.wrapped) : null;
    // the same device asking again keeps its approval (its key hasn't changed)
    const sameKey = existing && JSON.stringify(existing.publicKey) === JSON.stringify(publicKey);
    const approval: { wrapped?: Wrapped | PasskeyWrapped; approvedAt?: string; approvedBy?: string } = wrapped
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
    if (!existing || existing.kind === "passkey") return NextResponse.json({ error: "That device has gone" }, { status: 404 });
    if (!wrapped) return NextResponse.json({ error: "bad key" }, { status: 400 });
    await saveDevice(tenant, team, { ...existing, wrapped, approvedAt: now, approvedBy: me });
  } else if (body?.action === "remove") {
    await removeDevice(tenant, team, id);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return reply(req, ctx);
}
