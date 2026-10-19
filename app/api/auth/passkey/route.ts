// Passkeys (lib/passkeys.ts): adding them to your account, and signing in with one.
//   GET                                          -> { passkeys } (yours, signed in)
//   POST { action: "add-options" }               -> options for the browser to make one
//   POST { action: "add", response, label }      -> { passkey }
//   POST { action: "signin-options" }            -> options for the browser to use one
//   POST { action: "signin", response, next? }   -> { next } with the session cookie set
//   DELETE ?id=                                  -> removes one of yours
import { NextRequest, NextResponse } from "next/server";
import { createSession, currentUser, getUser, setPasskeyHint, setSessionCookie } from "@/lib/auth";
import { clientIp } from "@/lib/clientIp";
import { rawKv } from "@/lib/kv";
import {
  finishRegistration,
  finishSignIn,
  listPasskeys,
  registrationOptions,
  removePasskey,
  signInOptions,
  type Passkey,
} from "@/lib/passkeys";
import { safeNext } from "@/lib/safeNext";

export const dynamic = "force-dynamic";

const shown = (k: Passkey) => ({ id: k.id, label: k.label, prf: k.prf ?? null, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt ?? null });
const notSignedIn = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });

async function tooMany(req: NextRequest): Promise<boolean> {
  const kv = await rawKv();
  if (!kv) return true;
  const key = `platform:passkey-ip:${clientIp(req.headers)}`;
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, 3600);
  return n > 60;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return notSignedIn();
  return NextResponse.json({ passkeys: (await listPasskeys(user.id)).map(shown) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === "signin-options") {
    if (await tooMany(req)) return NextResponse.json({ error: "Too many tries — wait a while" }, { status: 429 });
    return NextResponse.json(await signInOptions(req));
  }
  if (action === "signin") {
    const userId = await finishSignIn(req, body?.response as never);
    const user = userId ? await getUser(userId) : null;
    if (!user) {
      return NextResponse.json({ error: "That passkey didn't work here — sign in with your email instead" }, { status: 400 });
    }
    const res = NextResponse.json({ next: safeNext(body?.next) });
    setSessionCookie(res, await createSession(user, "passkey"), req);
    setPasskeyHint(res, req, true);
    return res;
  }

  const user = await currentUser();
  if (!user) return notSignedIn();
  if (action === "add-options") {
    if (await tooMany(req)) return NextResponse.json({ error: "Too many tries — wait a while" }, { status: 429 });
    return NextResponse.json(await registrationOptions(req, user));
  }
  if (action === "add") {
    const label = typeof body?.label === "string" ? body.label : "";
    const key = await finishRegistration(req, user, body?.response as never, label);
    if (!key) return NextResponse.json({ error: "That passkey couldn't be added — try again" }, { status: 400 });
    const res = NextResponse.json({ passkey: shown(key) });
    setPasskeyHint(res, req, true);
    return res;
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return notSignedIn();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (id) await removePasskey(user.id, id);
  const keys = await listPasskeys(user.id);
  const res = NextResponse.json({ passkeys: keys.map(shown) });
  if (!keys.length) setPasskeyHint(res, req, false);
  return res;
}
