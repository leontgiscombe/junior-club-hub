// Phone alerts for approved members; join-request counts stay coach-only.
//   GET    ?key=…&endpoint=…  -> { pending, alerts, pushAvailable }   (alerts: whether this phone has them on)
//   POST   { subscription }   -> turn alerts on for this phone (an approved account)
//   POST   { apnsToken }      -> the same, for the App Store app (lib/apns.ts); its endpoint is "apns:<token>"
//   POST   { test, endpoint } -> send a test alert to this phone
//   DELETE { endpoint }       -> turn them off
// With no key, the signed-in account is used.
import { NextRequest, NextResponse } from "next/server";
import { SESSION_KEY, awaitingApproval } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { listMembers } from "@/lib/members";
import { addJoinAlert, addNativeAlert, hasJoinAlert, pushConfigured, removeJoinAlert, sendTestAlert } from "@/lib/notify";
import { isApnsToken } from "@/lib/apns";
import { currentPerson, listPeople } from "@/lib/people";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const unauthorised = () => NextResponse.json({ error: "Unauthorised" }, { status: 401 });

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || SESSION_KEY;
  const coach = await isCoach(key);
  const me = await signedInMember();
  if (!coach && !me) return unauthorised();
  const tenant = me?.tenant ?? await requireTenant();
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  const [people, members, alerts] = await Promise.all([
    coach ? listPeople(tenant) : [],
    coach ? listMembers(tenant) : [],
    endpoint && me ? hasJoinAlert(tenant, endpoint, me.userId) : false,
  ]);
  // the same count as Home's card and Members (lib/access.ts)
  const pending = awaitingApproval(people).length + members.filter((m) => m.status === "pending").length;
  return NextResponse.json({ pending, alerts, coach, pushAvailable: await pushConfigured() }, { headers: { "cache-control": "no-store" } });
}

/** Alerts belong to a person, so turning them on needs an account, not the shared password. */
async function signedInMember() {
  const tenant = await requireTenant();
  const me = await currentPerson(tenant).catch(() => null);
  return me?.person?.status === "approved" ? { tenant, userId: me.user.id } : null;
}

export async function POST(req: NextRequest) {
  const me = await signedInMember();
  if (!me) return unauthorised();
  if (!(await pushConfigured())) return NextResponse.json({ error: "Phone alerts aren't set up on this hub" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    test?: boolean;
    endpoint?: unknown;
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    apnsToken?: unknown;
  } | null;
  if (body?.test) {
    if (typeof body.endpoint !== "string") return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
    const error = await sendTestAlert(me.tenant, me.userId, body.endpoint);
    return error ? NextResponse.json({ error }, { status: 502 }) : NextResponse.json({ ok: true });
  }
  if (body?.apnsToken !== undefined) {
    if (!isApnsToken(body.apnsToken)) return NextResponse.json({ error: "That phone's token isn't right" }, { status: 400 });
    await addNativeAlert(me.tenant, me.userId, body.apnsToken);
    return NextResponse.json({ ok: true });
  }
  const sub = body?.subscription;
  if (
    typeof sub?.endpoint !== "string" ||
    !sub.endpoint.startsWith("https://") ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    return NextResponse.json({ error: "missing subscription" }, { status: 400 });
  }
  await addJoinAlert(me.tenant, me.userId, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await signedInMember();
  if (!me) return unauthorised();
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
  if (!(await hasJoinAlert(me.tenant, body.endpoint, me.userId))) return NextResponse.json({ error: "This subscription belongs to another account" }, { status: 403 });
  await removeJoinAlert(me.tenant, body.endpoint);
  return NextResponse.json({ ok: true });
}
