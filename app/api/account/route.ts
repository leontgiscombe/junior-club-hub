// The signed-in person's own account.
//   GET     -> { user, clubs: [{ id, name, url, roles, status }] }
//   GET     -> { user: { email, name, phone }, clubs: [...] }
//   PATCH   { name, phone? } -> changes their name and mobile number (and at each of their clubs)
//   DELETE  -> deletes the account (and its photo), signs out everywhere and leaves every club
import { NextRequest, NextResponse } from "next/server";
import { kvCall, peopleKey, readPerson, type Person } from "@/lib/access";
import { clearSessionCookie, currentUser, deleteUser, setUserName, setUserPhone, userClubsKey } from "@/lib/auth";
import { BAD_PHONE, NEED_PHONE, cleanPhone } from "@/lib/phone";
import { leaveClub } from "@/lib/people";
import { getClubFor } from "@/lib/settings";
import { tenantUrl } from "@/lib/tenant";
import { deletePhoto } from "@/lib/userPhoto";

export const dynamic = "force-dynamic";

const notSignedIn = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });

async function clubsOf(userId: string) {
  const ids = (await kvCall<string[]>(["SMEMBERS", userClubsKey(userId)])) ?? [];
  const out = [];
  for (const id of ids) {
    const person = await readPerson(id, userId);
    if (!person) continue;
    out.push({ id, name: (await getClubFor(id)).name, url: tenantUrl(id), roles: person.roles, status: person.status });
  }
  return out;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return notSignedIn();
  return NextResponse.json({ user: { email: user.email, name: user.name, phone: user.phone ?? "" }, clubs: await clubsOf(user.id) });
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return notSignedIn();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  // left out: kept as it is
  const phone = body?.phone === undefined ? (user.phone ?? "") : cleanPhone(body.phone);
  if (phone === null) return NextResponse.json({ error: BAD_PHONE }, { status: 400 });
  // it's required: it can be changed, not taken off
  if (!phone && body?.phone !== undefined) return NextResponse.json({ error: NEED_PHONE }, { status: 400 });
  await setUserName(user.id, name);
  await setUserPhone(user.id, phone);
  for (const club of (await kvCall<string[]>(["SMEMBERS", userClubsKey(user.id)])) ?? []) {
    const person = await readPerson(club, user.id);
    if (!person) continue;
    const next: Person = { ...person, name, phone };
    if (!phone) delete next.phone;
    await kvCall(["HSET", peopleKey(club), user.id, JSON.stringify(next)]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return notSignedIn();
  await deletePhoto(user.id);
  await deleteUser(user, leaveClub);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req);
  return res;
}
