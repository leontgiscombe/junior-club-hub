// The subs tracker's data: one encrypted blob per team, plus the team's login
// record (encryption salt and password verifier — never the password itself),
// so a password change reaches every device.
import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";
import { cleanAuth, type Auth } from "@/lib/financeAuth";
import {
  financeConfigured,
  financeKeys,
  redis,
} from "@/lib/financeStorage";

export const dynamic = "force-dynamic";

const parse = <T,>(v: unknown): T | null => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};

async function team(req: NextRequest) {
  // switched off on Coach Admin → Settings: no team is open
  if (!(await getClub()).features.financialAdmin) return null;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  return (await isTeam(id)) ? id : null;
}

export async function GET(req: NextRequest) {
  const keys = financeKeys(await requireTenant());
  const id = await team(req);
  if (!id) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  try {
    const [val, authVal] = await Promise.all([
      redis(["GET", keys.data(id)]),
      redis(["GET", keys.auth(id)]),
    ]);
    const rec = parse<{ blob?: unknown; rev?: number; updatedAt?: string }>(val) ?? {};
    return NextResponse.json(
      {
        blob: rec.blob ?? null,
        rev: rec.rev ?? 0,
        updatedAt: rec.updatedAt ?? null,
        auth: parse(authVal),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

type Body = {
  blob?: { ct?: unknown; iv?: unknown };
  auth?: Record<string, unknown>;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("base64");
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function put(req: NextRequest) {
  const keys = financeKeys(await requireTenant());
  const id = await team(req);
  if (!id) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.blob || typeof body.blob.ct !== "string" || typeof body.blob.iv !== "string") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  try {
    // A team with no password yet is set up once, by a coach who gives the
    // Coach Admin password; after that it can only be opened with its own.
    const current = parse<Auth>(await redis(["GET", keys.auth(id)]));
    const hasAuth = !!current;
    const setupKey = req.headers.get("x-admin-key");
    if (!hasAuth || setupKey !== null) {
      if (hasAuth) return NextResponse.json({ error: "team already set up" }, { status: 409 });
      if (!body.auth || !(await isCoach(setupKey ?? ""))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }
    // Saving needs the team's write token, which only someone who knows the
    // team password can work out; the server keeps just its SHA-256. Teams set
    // up before tokens existed have no writeHash until they next unlock.
    const auth = cleanAuth(body.auth);
    if (current?.writeHash) {
      const token = req.headers.get("x-write-token") ?? "";
      if (!token || !same(sha256(token), current.writeHash)) {
        return NextResponse.json({ error: "not allowed" }, { status: 403 });
      }
      // a password change can't take the protection away
      if (auth && !auth.writeHash) return NextResponse.json({ error: "bad login record" }, { status: 400 });
    }
    const cur = parse<{ rev?: number }>(await redis(["GET", keys.data(id)]));
    const record = {
      blob: { ct: body.blob.ct, iv: body.blob.iv },
      rev: (cur?.rev ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const writes = [redis(["SET", keys.data(id), JSON.stringify(record)])];
    // A password change (or a team's first write token) sends the team's new
    // login record with the data.
    if (auth) writes.push(redis(["SET", keys.auth(id), JSON.stringify(auth)]));
    await Promise.all(writes);
    return NextResponse.json({ rev: record.rev });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

export const PUT = put;
export const POST = put;
