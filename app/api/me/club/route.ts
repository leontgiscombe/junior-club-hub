// The signed-in person's own place at this club: their team and children.
//   GET                          -> { club, person: { status, relation, team, children } | null, teams, photos }
//                                   (photos: each of their own children's photo version, by squad player id)
//   PUT { children?, team? }     -> saves their children (a parent) or their own team
// Only their own record; the club's coaches see the changes in Members.
import { NextRequest, NextResponse } from "next/server";
import { childrenOf, readPerson } from "@/lib/access";
import { canCoach, cleanChildren, currentPerson, decideChild, pickTeam, updatePerson } from "@/lib/people";
import { listPlayers } from "@/lib/statsStorage";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { playerPhotoVersions } from "@/lib/playerPhoto";
import { notifyChildRemoved, notifyChildRequest } from "@/lib/notify";
import { recordRemoval } from "@/lib/childRemovals";

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
  p ? { status: p.status, roles: p.roles, relation: p.relation ?? null, team: p.team ?? null, children: childrenOf(p) } : null;

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // their own children's photos (only once approved: the photo API checks the same)
  const mine = ctx.me.person?.status === "approved" ? childrenOf(ctx.me.person).flatMap((c) => (c.playerId ? [c.playerId] : [])) : [];
  const versions = mine.length ? await playerPhotoVersions().catch(() => ({}) as Record<string, string>) : {};
  const photos = Object.fromEntries(mine.flatMap((id) => (versions[id] ? [[id, versions[id]]] : [])));
  return NextResponse.json({ club: (await getClub()).name, person: view(ctx.me.person), teams: ctx.teams, photos });
}

export async function PUT(req: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!ctx.me.person) return NextResponse.json({ error: "Join the club first" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const before = childrenOf(ctx.me.person);
  const waitingBefore = new Set(before.flatMap((c) => (c.pending ? [c.id] : [])));
  let person = await updatePerson(ctx.tenant, ctx.me.user.id, {
    ...(body && "children" in body ? { children: cleanChildren(body.children, ctx.teams) } : {}),
    ...(body && "team" in body ? { team: pickTeam(body.team, ctx.teams) ?? null } : {}),
  });
  // a child just added waits for a coach: let them know
  let added = person ? childrenOf(person).filter((c) => c.pending && !waitingBefore.has(c.id)) : [];
  // …unless they're a coach (or club admin) themselves: their own child goes
  // straight into the squad, as the same player if they're there already
  if (added.length && person && canCoach(person)) {
    const players = await listPlayers();
    const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
    for (const c of added) {
      const match =
        players.find((p) => same(p.name, c.name) && (!c.requestedTeam || p.team === c.requestedTeam.slug)) ?? players.find((p) => same(p.name, c.name));
      await decideChild(ctx.tenant, person.userId, c.id, { approve: true, ...(match ? { link: match.id } : { team: c.requestedTeam }) });
    }
    person = (await readPerson(ctx.tenant, person.userId)) ?? person;
    added = [];
  }
  if (added.length && person) {
    await notifyChildRequest(ctx.tenant, {
      userId: person.userId,
      parentName: person.name,
      childNames: added.map((c) => c.name),
      teams: [...new Set(added.flatMap((c) => (c.requestedTeam ? [c.requestedTeam.slug] : [])))],
      clubName: (await getClub()).name,
    });
  }
  // a child in the squad taken off their account: noted for the coaches, who hear about it
  const still = new Set(person ? childrenOf(person).flatMap((c) => (c.playerId ? [c.playerId] : [])) : []);
  const removed = person?.status === "approved" ? before.filter((c) => c.playerId && !still.has(c.playerId)) : [];
  if (removed.length && person) {
    const at = new Date().toISOString();
    for (const c of removed) await recordRemoval(ctx.tenant, c.playerId!, { userId: person.userId, by: person.name, at });
    await notifyChildRemoved(ctx.tenant, {
      userId: person.userId,
      parentName: person.name,
      playerIds: removed.map((c) => c.playerId!),
      teams: [...new Set(removed.flatMap((c) => (c.team ? [c.team.slug] : [])))],
      clubName: (await getClub()).name,
    });
  }
  return NextResponse.json({ person: view(person) });
}
