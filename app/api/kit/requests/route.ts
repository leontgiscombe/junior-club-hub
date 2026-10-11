// A signed-in parent's (or player's) own kit requests.
//   GET                                   -> { requests: KitRequest[] } (theirs)
//   POST   { childId, item, size, quantity?, note? } -> asks for kit; the team's coaches are told
//   DELETE ?id=…                          -> takes back one of theirs still waiting
import { NextResponse } from "next/server";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { currentPerson } from "@/lib/people";
import { isKitItem, itemsFor, KIT_ITEMS } from "@/lib/kitItems";
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

export async function POST(request: Request) {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const club = await getClub();
  if (!club.features.kitSizes) return NextResponse.json({ error: "Kit isn't being handled through the hub" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const child = kitFamily(me.person).find((c) => c.id === body.childId);
  if (!child) return NextResponse.json({ error: "Choose who it's for" }, { status: 400 });
  const item = body.item;
  if (!isKitItem(item) || !itemsFor(club.kitExtras).includes(item)) {
    return NextResponse.json({ error: "Choose an item" }, { status: 400 });
  }
  const size = String(body.size ?? "");
  if (!KIT_ITEMS[item].sizes.includes(size)) return NextResponse.json({ error: "Choose a size" }, { status: 400 });
  const quantity = Math.min(5, Math.max(1, Math.floor(Number(body.quantity) || 1)));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";

  const mine = (await listKitRequests()).filter((r) => r.userId === me.person.userId && !r.doneAt);
  if (mine.length >= MAX_OPEN_PER_PERSON) {
    return NextResponse.json({ error: "You've a lot of requests waiting — please wait for the coaches to sort those first" }, { status: 429 });
  }

  const saved = await addKitRequest({
    team: child.team,
    childName: child.name,
    item,
    size,
    quantity,
    ...(note ? { note } : {}),
    userId: me.person.userId,
    requestedBy: me.person.name,
  });
  const teamName = (await getTeams()).find((t) => t.slug === child.team)?.name ?? "";
  await notifyKitRequest(me.tenant, {
    team: child.team,
    teamName,
    item: KIT_ITEMS[item].label,
    size,
    quantity,
    clubName: club.name,
  });
  return NextResponse.json({ success: true, request: saved });
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
