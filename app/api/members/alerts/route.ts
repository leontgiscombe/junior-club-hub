// Join requests for club admins and coaches: how many are waiting (the badge in
// Coach Admin and on the home page), and turning this phone's alerts on or off.
//   GET    ?key=…&endpoint=…  -> { pending, alerts, pushAvailable }   (alerts: whether this phone has them on)
//   POST   { subscription }   -> turn alerts on for this phone   (signed in as a club admin or coach)
//   POST   { test, endpoint } -> send a test alert to this phone
//   DELETE { endpoint }       -> turn them off
// With no key, the signed-in account is used.
import { NextRequest, NextResponse } from "next/server";
import { SESSION_KEY, awaitingApproval } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { listMembers } from "@/lib/members";
import { addJoinAlert, hasJoinAlert, pushConfigured, removeJoinAlert, sendTestAlert } from "@/lib/notify";
import { canCoach, currentPerson, listPeople } from "@/lib/people";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const unauthorised = () => NextResponse.json({ error: "Unauthorised" }, { status: 401 });

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || SESSION_KEY;
  if (!(await isCoach(key))) return unauthorised();
  const tenant = await requireTenant();
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  const [people, members, alerts] = await Promise.all([
    listPeople(tenant),
    listMembers(tenant),
    endpoint ? hasJoinAlert(tenant, endpoint) : false,
  ]);
  // the same count as Home's card and Members (lib/access.ts)
  const pending = awaitingApproval(people).length + members.filter((m) => m.status === "pending").length;
  return NextResponse.json({ pending, alerts, pushAvailable: await pushConfigured() }, { headers: { "cache-control": "no-store" } });
}

/** Alerts belong to a person, so turning them on needs an account, not the shared password. */
async function signedInCoach() {
  const tenant = await requireTenant();
  const me = await currentPerson(tenant).catch(() => null);
  return me && canCoach(me.person) ? { tenant, userId: me.user.id } : null;
}

export async function POST(req: NextRequest) {
  const me = await signedInCoach();
  if (!me) return unauthorised();
  if (!(await pushConfigured())) return NextResponse.json({ error: "Phone alerts aren't set up on this hub" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    test?: boolean;
    endpoint?: unknown;
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  } | null;
  if (body?.test) {
    if (typeof body.endpoint !== "string") return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
    const error = await sendTestAlert(me.tenant, me.userId, body.endpoint);
    return error ? NextResponse.json({ error }, { status: 502 }) : NextResponse.json({ ok: true });
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
  const me = await signedInCoach();
  if (!me) return unauthorised();
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
  await removeJoinAlert(me.tenant, body.endpoint);
  return NextResponse.json({ ok: true });
}
