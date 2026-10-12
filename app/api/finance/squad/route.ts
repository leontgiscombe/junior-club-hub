// A team's squad from Members, for Financial Admin's players: each child
// with their approved parents and carers. The finance records are encrypted in
// the browser, so the page adds anyone missing itself. Only for someone who
// knows the team password (its write token) or a signed-in treasurer or admin.
//   GET ?id=team  (header x-write-token) -> { players: [{ id, name, createdAt, guardians: [{ name, email, phone }] }] }
// A player missing from the list has left the team (or moved to another), so
// the page stops charging them.
import { NextRequest, NextResponse } from "next/server";
import { childrenOf } from "@/lib/access";
import { financeUser } from "@/lib/financeDevices";
import { financeConfigured } from "@/lib/financeStorage";
import { UNLOCK_FAILS, teamRecord, tokenMatches } from "@/lib/financeTeam";
import { listPeople } from "@/lib/people";
import { atLimit, overLimit } from "@/lib/rateLimit";
import { getClub, isTeam } from "@/lib/settings";
import { listPlayers } from "@/lib/statsStorage";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getClub()).features.financialAdmin) return NextResponse.json({ error: "Financial Admin is off" }, { status: 404 });
  if (!financeConfigured()) return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  const tenant = await requireTenant();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!(await isTeam(id))) return NextResponse.json({ error: "unknown team" }, { status: 400 });

  if (!(await financeUser(tenant, id))) {
    if (await atLimit("finance-unlock", UNLOCK_FAILS)) {
      return NextResponse.json({ error: "Too many wrong passwords — try again in an hour" }, { status: 429 });
    }
    const { auth } = await teamRecord(tenant, id);
    if (!tokenMatches(auth, req.headers.get("x-write-token") ?? "")) {
      await overLimit("finance-unlock", UNLOCK_FAILS, 3600);
      return NextResponse.json({ error: "not allowed" }, { status: 403 });
    }
  }

  const [players, people] = await Promise.all([listPlayers(), listPeople(tenant)]);
  const squad = players
    .filter((p) => p.team === id)
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      createdAt: p.createdAt,
      guardians: people
        .filter((person) => person.status === "approved" && childrenOf(person).some((c) => c.playerId === p.id))
        .map((person) => ({ name: person.name, email: person.email, phone: person.phone ?? "" })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ players: squad }, { headers: { "cache-control": "no-store" } });
}
