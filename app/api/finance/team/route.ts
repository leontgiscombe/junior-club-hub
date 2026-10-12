// The subs tracker's data: one encrypted blob per team, plus the team's login
// record (encryption salt and password verifier — never the password itself),
// so a password change reaches every device.
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";
import { cleanAuth, type Auth } from "@/lib/financeAuth";
import { financeUser } from "@/lib/financeDevices";
import { atLimit, overLimit } from "@/lib/rateLimit";
import { UNLOCK_FAILS, lockedAuth, sameToken, teamRecord, tokenMatches } from "@/lib/financeTeam";
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
  const tenant = await requireTenant();
  const id = await team(req);
  if (!id) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const noStore = { headers: { "cache-control": "no-store" } };
  try {
    const record = await teamRecord(tenant, id);
    const { auth } = record;
    // no password yet, or a team from before write tokens (it gets one the
    // next time it's unlocked): nothing to check against
    if (!auth || !auth.writeHash) return NextResponse.json(record, noStore);
    // a signed-in treasurer or club admin
    if (await financeUser(tenant)) return NextResponse.json(record, noStore);
    // someone who knows the team password
    const token = req.headers.get("x-write-token") ?? "";
    if (token) {
      if (await atLimit("finance-unlock", UNLOCK_FAILS)) {
        return NextResponse.json({ error: "Too many wrong passwords — try again in an hour" }, { status: 429 });
      }
      if (tokenMatches(auth, token)) return NextResponse.json(record, noStore);
      await overLimit("finance-unlock", UNLOCK_FAILS, 3600);
    }
    return NextResponse.json({ blob: null, rev: record.rev, updatedAt: record.updatedAt, auth: lockedAuth(auth) }, noStore);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

type Body = {
  blob?: { ct?: unknown; iv?: unknown };
  auth?: Record<string, unknown>;
};


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
    // A team with no password yet is set up once — by a signed-in treasurer or
    // club admin, or a coach who gives the Coach Admin password; after that it
    // can only be opened with its own.
    const current = parse<Auth>(await redis(["GET", keys.auth(id)]));
    const hasAuth = !!current;
    const setupKey = req.headers.get("x-admin-key");
    if (!hasAuth || setupKey !== null) {
      if (hasAuth) return NextResponse.json({ error: "team already set up" }, { status: 409 });
      const allowed = setupKey ? await isCoach(setupKey) : !!(await financeUser(await requireTenant()));
      if (!body.auth || !allowed) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }
    // Saving needs the team's write token, which only someone who knows the
    // team password can work out; the server keeps just its SHA-256. Teams set
    // up before tokens existed have no writeHash until they next unlock.
    const auth = cleanAuth(body.auth);
    if (current?.writeHash) {
      const token = req.headers.get("x-write-token") ?? "";
      const tokenOk = sameToken(token, current.writeHash);
      // A device opened with an account (lib/financeDevices.ts) has no team
      // password to work the token out from: a signed-in treasurer or club
      // admin can save the team's records instead — but not change its login.
      const accountOk =
        !tokenOk && !body.auth && req.headers.get("x-finance-account") === "1" && !!(await financeUser(await requireTenant()));
      if (!tokenOk && !accountOk) {
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
