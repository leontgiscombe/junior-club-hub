// Coach Admin → Players: the club's squad, team by team, with the parents of
// each player (from their accounts). The club decides each player's team.
//   GET  ?key=…                         -> { teams, players: [{ id, name, team, parents, requestedTeam? }] }
//   POST ?key=… { id, team }            -> puts a player in a team ("" for no team yet)
import { NextRequest, NextResponse } from "next/server";
import { childrenOf } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { assignPlayerTeam, listPeople } from "@/lib/people";
import { getTeams } from "@/lib/settings";
import { listPlayers } from "@/lib/statsStorage";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function snapshot(tenant: string) {
  const [teams, players, people] = await Promise.all([getTeams(), listPlayers(), listPeople(tenant)]);
  const parents = new Map<string, { name: string; email: string }[]>();
  const requested = new Map<string, { slug: string; name: string }>();
  for (const person of people) {
    if (person.status !== "approved") continue;
    for (const c of childrenOf(person)) {
      if (!c.playerId) continue;
      parents.set(c.playerId, [...(parents.get(c.playerId) ?? []), { name: person.name, email: person.email }]);
      if (c.requestedTeam) requested.set(c.playerId, c.requestedTeam);
    }
  }
  return {
    teams: teams.map((t) => ({ slug: t.slug, name: t.name })),
    players: players
      .map((p) => ({
        id: p.id,
        name: p.name,
        team: teams.some((t) => t.slug === p.team) ? p.team : "",
        parents: parents.get(p.id) ?? [],
        ...(requested.has(p.id) ? { requestedTeam: requested.get(p.id) } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function GET(req: NextRequest) {
  if (!(await isCoach(req.nextUrl.searchParams.get("key") ?? ""))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return NextResponse.json(await snapshot(await requireTenant()));
}

export async function POST(req: NextRequest) {
  if (!(await isCoach(req.nextUrl.searchParams.get("key") ?? ""))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const tenant = await requireTenant();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!(await assignPlayerTeam(tenant, String(body?.id ?? ""), String(body?.team ?? "")))) {
    return NextResponse.json({ error: "Couldn't move that player — refresh and try again" }, { status: 400 });
  }
  return NextResponse.json(await snapshot(tenant));
}
