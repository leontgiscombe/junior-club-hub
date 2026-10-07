// A coach resetting a team's Financial Admin password from Coach Admin →
// Settings, with the Coach Admin password. The new login record is made in the
// coach's browser:
//   - with the team's recovery code, it locks the same data key with the new
//     password, so the team's records are kept (keep: true);
//   - without it, there's no way to open the old records, so they're deleted
//     and the team starts again (keep: false).
//   POST ?id=team  { auth, keep }   (header x-admin-key)
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { financeConfigured, financeKeys, redis } from "@/lib/financeStorage";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";
import { cleanAuth, type Auth } from "@/lib/financeAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isCoach(req.headers.get("x-admin-key") ?? ""))) {
    return NextResponse.json({ error: "That Coach Admin password isn't right" }, { status: 401 });
  }
  if (!(await getClub()).features.financialAdmin) return NextResponse.json({ error: "Financial Admin is off" }, { status: 400 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!(await isTeam(id))) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { auth?: Record<string, unknown>; keep?: unknown } | null;
  const auth = cleanAuth(body?.auth);
  // the new record must be complete: a data key, a write token and a recovery code
  if (!auth?.wrapPass || !auth.writeHash || !auth.wrapRec) {
    return NextResponse.json({ error: "bad login record" }, { status: 400 });
  }
  const keys = financeKeys(await requireTenant());
  try {
    if (body?.keep === true) {
      // keeping the data means keeping the recovery lock it was opened with
      const raw = await redis(["GET", keys.auth(id)]);
      const current = typeof raw === "string" ? (JSON.parse(raw) as Auth) : null;
      if (!current?.wrapRec || current.recSalt !== auth.recSalt || current.wrapRec.ct !== auth.wrapRec.ct) {
        return NextResponse.json({ error: "This team has no recovery code to reset with" }, { status: 409 });
      }
      await redis(["SET", keys.auth(id), JSON.stringify(auth)]);
    } else {
      await redis(["DEL", keys.data(id)]);
      await redis(["SET", keys.auth(id), JSON.stringify(auth)]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
