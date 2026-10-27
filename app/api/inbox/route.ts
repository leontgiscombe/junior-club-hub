// The signed-in member's notifications (lib/inbox.ts), behind the bell.
//   GET            → { items, seenAt, unread }
//   GET ?count=1   → { unread } — for the bell's red number
//   POST { action: "seen" } — they've opened Notifications
import { NextResponse } from "next/server";
import { currentPerson } from "@/lib/people";
import { markInboxSeen, readInbox, unreadCount } from "@/lib/inbox";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

async function member() {
  const tenant = await getTenant();
  if (!tenant) return null;
  const me = await currentPerson(tenant).catch(() => null);
  return me?.person?.status === "approved" ? { tenant, person: me.person } : null;
}

export async function GET(request: Request) {
  const who = await member();
  if (!who) return NextResponse.json({ unread: 0 }, { status: 401, headers: NO_STORE });
  try {
    const { items, seenAt } = await readInbox(who.tenant, who.person);
    const unread = unreadCount(items, seenAt);
    if (new URL(request.url).searchParams.has("count")) return NextResponse.json({ unread }, { headers: NO_STORE });
    return NextResponse.json({ items, seenAt, unread }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Could not load your notifications" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  const who = await member();
  if (!who) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action !== "seen") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  await markInboxSeen(who.tenant, who.person.userId);
  return NextResponse.json({ ok: true });
}
