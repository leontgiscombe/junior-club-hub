// Opening a team's Financial Admin with your account: no team password, just
// Face ID or a fingerprint (lib/financeEscrow.ts). Only the team's own
// treasurer or a club admin (lib/financeDevices.ts: financeTeamsOf).
//   GET  ?team=                         -> { ready, faceId }: whether the team's key is kept here yet,
//                                          and whether opening it asks for Face ID (a passkey on the account)
//   POST { action: "options" }          -> the Face ID challenge, for the browser
//   POST { action: "open", team, response? } -> { key, record }: the team's key (base64) and records
//   POST { action: "save", team, key }  -> { ok }: keep a team's key, from a page that has just opened it
//                                          (with the team's write token, an account allowed the team,
//                                          or the Coach Admin password in x-admin-key, when setting it up)
import { NextRequest, NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { financeUser } from "@/lib/financeDevices";
import { saveTeamKey, teamKey } from "@/lib/financeEscrow";
import { financeConfigured } from "@/lib/financeStorage";
import { teamRecord, tokenMatches } from "@/lib/financeTeam";
import { finishSignIn, listPasskeys, signInOptions } from "@/lib/passkeys";
import { overLimit } from "@/lib/rateLimit";
import { getClub, isTeam } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
const noStore = { headers: { "cache-control": "no-store" } };

async function ready(): Promise<string | null> {
  if (!(await getClub()).features.financialAdmin) return "Finances is switched off";
  if (!financeConfigured()) return "storage not configured";
  return null;
}

export async function GET(req: NextRequest) {
  const off = await ready();
  if (off) return NextResponse.json({ error: off }, { status: 400 });
  const tenant = await requireTenant();
  const team = req.nextUrl.searchParams.get("team") ?? "";
  if (!(await isTeam(team))) return NextResponse.json({ error: "unknown team" }, { status: 400 });
  const user = await financeUser(tenant, team);
  if (!user) return NextResponse.json({ error: "Only this team's treasurer or a club admin" }, { status: 403 });
  const [key, passkeys] = await Promise.all([teamKey(tenant, team), listPasskeys(user.id)]);
  return NextResponse.json({ ready: !!key, faceId: passkeys.length > 0 }, noStore);
}

export async function POST(req: NextRequest) {
  const off = await ready();
  if (off) return NextResponse.json({ error: off }, { status: 400 });
  const tenant = await requireTenant();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "options") return NextResponse.json(await signInOptions(req), noStore);

  const team = typeof body?.team === "string" ? body.team : "";
  if (!(await isTeam(team))) return NextResponse.json({ error: "unknown team" }, { status: 400 });

  if (body?.action === "open") {
    if (await overLimit("finance-open", 60, 3600)) return NextResponse.json({ error: "Too many tries — wait a while" }, { status: 429 });
    const user = await financeUser(tenant, team);
    if (!user) return NextResponse.json({ error: "Only this team's treasurer or a club admin can open it without its password" }, { status: 403 });
    // with a passkey on the account, it's Face ID (or a fingerprint) each time
    if ((await listPasskeys(user.id)).length) {
      const who = body.response ? await finishSignIn(req, body.response as Parameters<typeof finishSignIn>[1]) : null;
      if (who !== user.id) return NextResponse.json({ error: "Face ID didn't match your account — try again" }, { status: 401 });
    }
    const key = await teamKey(tenant, team);
    if (!key) return NextResponse.json({ error: "not ready" }, { status: 404 });
    return NextResponse.json({ key: key.toString("base64"), record: await teamRecord(tenant, team) }, noStore);
  }

  if (body?.action === "save") {
    const key = typeof body.key === "string" ? Buffer.from(body.key, "base64") : null;
    if (!key) return NextResponse.json({ error: "bad key" }, { status: 400 });
    const { auth } = await teamRecord(tenant, team);
    const adminKey = req.headers.get("x-admin-key");
    const allowed =
      tokenMatches(auth, req.headers.get("x-write-token") ?? "") ||
      !!(await financeUser(tenant, team)) ||
      (adminKey !== null && (await isCoach(adminKey)));
    if (!allowed) return NextResponse.json({ error: "not allowed" }, { status: 403 });
    return (await saveTeamKey(tenant, team, key))
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "That key doesn't open the team" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
