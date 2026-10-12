// Unlocking Financial Admin with a team password. The password says which
// team it is, so the page works out a write token for every team (from each
// team's writeSalt) and sends them all; the team whose token matches gets its
// whole record back. Wrong passwords are counted per address — one per try,
// however many teams there are.
//   POST { tokens: { [teamId]: token } } -> { id, record } | 401
import { NextRequest, NextResponse } from "next/server";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";
import { financeConfigured } from "@/lib/financeStorage";
import { UNLOCK_FAILS, teamRecord, tokenMatches } from "@/lib/financeTeam";
import { atLimit, overLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await getClub()).features.financialAdmin) return NextResponse.json({ error: "Financial Admin is off" }, { status: 404 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const tenant = await requireTenant();
  const body = (await req.json().catch(() => null)) as { tokens?: unknown } | null;
  const tokens = body?.tokens && typeof body.tokens === "object" ? (body.tokens as Record<string, unknown>) : {};
  const tries = Object.entries(tokens).filter(
    (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0 && e[1].length < 200,
  );
  if (tries.length === 0 || tries.length > 30) return NextResponse.json({ error: "bad body" }, { status: 400 });
  if (await atLimit("finance-unlock", UNLOCK_FAILS)) {
    return NextResponse.json({ error: "Too many wrong passwords — try again in an hour" }, { status: 429 });
  }
  for (const [id, token] of tries) {
    if (!(await isTeam(id))) continue;
    const record = await teamRecord(tenant, id);
    if (tokenMatches(record.auth, token)) {
      return NextResponse.json({ id, record }, { headers: { "cache-control": "no-store" } });
    }
  }
  await overLimit("finance-unlock", UNLOCK_FAILS, 3600);
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
