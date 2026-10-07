// The signed-in person's own place at this club: their team and children.
//   GET                          -> { club, person: { status, relation, team, children } | null, teams }
//   PUT { children?, team? }     -> saves their children (a parent) or their own team
// Only their own record; the club's coaches see the changes in Members.
import { NextRequest, NextResponse } from "next/server";
import { childrenOf } from "@/lib/access";
import { cleanChildren, currentPerson, pickTeam, updatePerson } from "@/lib/people";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function context() {
  const tenant = await getTenant();
  if (!tenant) return null;
  const me = await currentPerson(tenant);
  if (!me) return null;
  const teams = (await getTeams()).map((t) => ({ slug: t.slug, name: t.name }));
  return { tenant, me, teams };
}

const view = (p: NonNullable<Awaited<ReturnType<typeof currentPerson>>>["person"]) =>
  p ? { status: p.status, relation: p.relation ?? null, team: p.team ?? null, children: childrenOf(p) } : null;

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ club: (await getClub()).name, person: view(ctx.me.person), teams: ctx.teams });
}

export async function PUT(req: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!ctx.me.person) return NextResponse.json({ error: "Join the club first" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const person = await updatePerson(ctx.tenant, ctx.me.user.id, {
    ...(body && "children" in body ? { children: cleanChildren(body.children, ctx.teams) } : {}),
    ...(body && "team" in body ? { team: pickTeam(body.team, ctx.teams) ?? null } : {}),
  });
  return NextResponse.json({ person: view(person) });
}
