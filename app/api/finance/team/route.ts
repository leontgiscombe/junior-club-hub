// The subs tracker's data: one encrypted blob per team, plus the team's login
// record (encryption salt and password verifier — never the password itself),
// so a password change reaches every device.
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword } from "@/lib/adminAuth";
import {
  FINANCE_TEAMS,
  financeAuthKey,
  financeConfigured,
  financeDataKey,
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

function team(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  return FINANCE_TEAMS.includes(id) ? id : null;
}

export async function GET(req: NextRequest) {
  const id = team(req);
  if (!id) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  try {
    const [val, authVal] = await Promise.all([
      redis(["GET", financeDataKey(id)]),
      redis(["GET", financeAuthKey(id)]),
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
  auth?: { encSalt?: unknown; verifySalt?: unknown; verifyHash?: unknown };
};

async function put(req: NextRequest) {
  const id = team(req);
  if (!id) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.blob || typeof body.blob.ct !== "string" || typeof body.blob.iv !== "string") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  try {
    // A team with no password yet is set up once, by a coach who gives the
    // Coach Admin password; after that it can only be opened with its own.
    const hasAuth = !!parse(await redis(["GET", financeAuthKey(id)]));
    const setupKey = req.headers.get("x-admin-key");
    if (!hasAuth || setupKey !== null) {
      if (hasAuth) return NextResponse.json({ error: "team already set up" }, { status: 409 });
      if (!body.auth || !checkAdminPassword(setupKey ?? "", process.env.ADMIN_KEY)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }
    const cur = parse<{ rev?: number }>(await redis(["GET", financeDataKey(id)]));
    const record = {
      blob: { ct: body.blob.ct, iv: body.blob.iv },
      rev: (cur?.rev ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const writes = [redis(["SET", financeDataKey(id), JSON.stringify(record)])];
    // A password change sends the team's new login record with the data.
    const a = body.auth;
    if (
      a &&
      typeof a.encSalt === "string" &&
      typeof a.verifySalt === "string" &&
      typeof a.verifyHash === "string"
    ) {
      writes.push(
        redis([
          "SET",
          financeAuthKey(id),
          JSON.stringify({ encSalt: a.encSalt, verifySalt: a.verifySalt, verifyHash: a.verifyHash }),
        ]),
      );
    }
    await Promise.all(writes);
    return NextResponse.json({ rev: record.rev });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

export const PUT = put;
export const POST = put;
