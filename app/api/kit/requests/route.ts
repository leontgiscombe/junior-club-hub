// A signed-in parent's (or player's) own kit requests.
//   GET                                   -> { requests: KitRequest[] } (theirs)
//   POST   { items: [{ childId, item, size, quantity? }], note? } -> asks for a basket of kit (or one
//          item, { childId, item, size, quantity?, note? }); each team's coaches get one alert
//   DELETE ?id=…                          -> takes back one of theirs still waiting
import { NextResponse } from "next/server";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { currentPerson } from "@/lib/people";
import { isKitItem, itemsFor, KIT_ITEMS, type KitItem } from "@/lib/kitItems";
import {
  MAX_OPEN_PER_PERSON,
  addKitRequest,
  deleteKitRequest,
  kitFamily,
  listKitRequests,
} from "@/lib/kitRequests";
import { notifyKitRequest } from "@/lib/notify";

export const runtime = "nodejs";

/** The signed-in, approved person on this club's hub, or null. */
async function who() {
  const tenant = await getTenant();
  if (!tenant) return null;
  const me = await currentPerson(tenant).catch(() => null);
  return me?.person?.status === "approved" ? { tenant, person: me.person } : null;
}

export async function GET() {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const requests = (await listKitRequests()).filter((r) => r.userId === me.person.userId);
  return NextResponse.json({ requests });
}

/** The most lines one order (basket) can have. */
const MAX_BASKET = 10;

export async function POST(request: Request) {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const club = await getClub();
  if (!club.features.kitSizes) return NextResponse.json({ error: "Kit isn't being handled through the hub" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  // a basket of { childId, item, size, quantity } — or, from before baskets, one item on its own
  const lines: Record<string, unknown>[] = Array.isArray(body.items) ? body.items.slice(0, MAX_BASKET + 1) : [body];
  if (!lines.length) return NextResponse.json({ error: "Your basket is empty" }, { status: 400 });
  if (lines.length > MAX_BASKET) return NextResponse.json({ error: `Up to ${MAX_BASKET} items in one go, please` }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";

  const family = kitFamily(me.person);
  const allowedItems = itemsFor(club.kitExtras);
  const order: { child: (typeof family)[number]; item: KitItem; size: string; quantity: number }[] = [];
  for (const line of lines) {
    const child = family.find((c) => c.id === line.childId);
    if (!child) return NextResponse.json({ error: "Choose who it's for" }, { status: 400 });
    const item = line.item;
    if (!isKitItem(item) || !allowedItems.includes(item)) return NextResponse.json({ error: "Choose an item" }, { status: 400 });
    const size = String(line.size ?? "");
    if (!KIT_ITEMS[item].sizes.includes(size)) return NextResponse.json({ error: "Choose a size" }, { status: 400 });
    order.push({ child, item, size, quantity: Math.min(5, Math.max(1, Math.floor(Number(line.quantity) || 1))) });
  }

  const waiting = (await listKitRequests()).filter((r) => r.userId === me.person.userId && !r.doneAt).length;
  if (waiting + order.length > MAX_OPEN_PER_PERSON) {
    return NextResponse.json({ error: "You've a lot of requests waiting — please wait for the coaches to sort those first" }, { status: 429 });
  }

  const saved = [];
  for (const o of order) {
    saved.push(
      await addKitRequest({
        team: o.child.team,
        childName: o.child.name,
        item: o.item,
        size: o.size,
        quantity: o.quantity,
        ...(note ? { note } : {}),
        userId: me.person.userId,
        requestedBy: me.person.name,
      }),
    );
  }
  // one alert per team, listing everything asked for
  const teams = await getTeams();
  for (const team of [...new Set(order.map((o) => o.child.team))]) {
    await notifyKitRequest(me.tenant, {
      team,
      teamName: teams.find((t) => t.slug === team)?.name ?? "",
      items: order.filter((o) => o.child.team === team).map((o) => ({ item: KIT_ITEMS[o.item].label, size: o.size, quantity: o.quantity })),
      clubName: club.name,
    });
  }
  return NextResponse.json({ success: true, requests: saved, request: saved[0] });
}

export async function DELETE(request: Request) {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!(await deleteKitRequest(id, me.person.userId))) {
    return NextResponse.json({ error: "That request can't be taken back" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
