// Coach Admin → Members: the club's join code, whether the hub is private, and
// the people who've asked to join. Behind the coach password.
//   GET  ?key=…                                   -> { private, code, joinUrl, platformJoin, people, members }
//   POST ?key=… { action: "approvePerson" | "personRoles", userId, roles, links? }  (people with accounts;
//                                            approving adds a parent's children to the squad — links
//                                            maps a child to an existing squad player instead)
//   POST ?key=… { action: "declinePerson" | "removePerson", userId }
//   POST ?key=… { action: "editPerson", userId, team?, children? }      (fix someone's team or children)
//   POST ?key=… { action: "approve" | "decline" | "remove", id }        (phones approved before accounts)
//   POST ?key=… { action: "newCode" }             -> a new join code (the old one stops working)
//   POST ?key=… { action: "private", value }      -> only approved members can open the hub (or anyone)
import { NextRequest, NextResponse } from "next/server";
import { showCode } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { decide, getAccess, listMembers, renewCode, setPrivate } from "@/lib/members";
import { addChildrenToSquad, cleanChildren, decidePerson, isRole, listPeople, pickTeam, updatePerson } from "@/lib/people";
import { listPlayers } from "@/lib/statsStorage";
import { getTeams } from "@/lib/settings";
import { DEFAULT_TENANT, platformUrl, requireTenant, rootDomain, tenantUrl } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function snapshot(tenant: string) {
  const [access, members, people, teams, players] = await Promise.all([
    getAccess(tenant),
    listMembers(tenant),
    listPeople(tenant),
    getTeams(),
    listPlayers(),
  ]);
  return {
    private: access.private,
    code: showCode(access.code),
    joinUrl: tenantUrl(tenant, `/join?code=${access.code}`),
    // the platform's "join your club" box only finds clubs with their own address
    platformJoin: tenant !== DEFAULT_TENANT && rootDomain() ? platformUrl("/") : null,
    people,
    members,
    teams: teams.map((t) => ({ slug: t.slug, name: t.name })),
    // the squad, for linking a new parent's children to players already there
    players: players.map((p) => ({ id: p.id, name: p.name, team: p.team })).sort((a, b) => a.name.localeCompare(b.name)),
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
  const action = body?.action;
  if (action === "editPerson") {
    const teams = (await getTeams()).map((t) => ({ slug: t.slug, name: t.name }));
    const done = await updatePerson(tenant, String(body?.userId ?? ""), {
      ...(body && "team" in body ? { team: pickTeam(body.team, teams) ?? null } : {}),
      ...(body && "children" in body ? { children: cleanChildren(body.children, teams) } : {}),
    }, { byCoach: true });
    if (!done) return NextResponse.json({ error: "That person isn't on the list any more" }, { status: 404 });
  } else if (action === "approvePerson" || action === "personRoles" || action === "declinePerson" || action === "removePerson") {
    const roles = Array.isArray(body?.roles) ? body.roles.filter(isRole) : [];
    if ((action === "approvePerson" || action === "personRoles") && !roles.length) {
      return NextResponse.json({ error: "Choose at least one role" }, { status: 400 });
    }
    const verb = action === "approvePerson" ? "approve" : action === "personRoles" ? "roles" : action === "declinePerson" ? "decline" : "remove";
    const userId = String(body?.userId ?? "");
    if (!(await decidePerson(tenant, userId, verb, roles))) {
      return NextResponse.json({ error: "That person isn't on the list any more" }, { status: 404 });
    }
    if (verb === "approve") {
      const links = body?.links && typeof body.links === "object" ? (body.links as Record<string, string>) : {};
      await addChildrenToSquad(tenant, userId, links);
    }
  } else if (action === "approve" || action === "decline" || action === "remove") {
    if (!(await decide(tenant, String(body?.id ?? ""), action))) {
      return NextResponse.json({ error: "That person isn't on the list any more" }, { status: 404 });
    }
  } else if (action === "newCode") {
    await renewCode(tenant);
  } else if (action === "private") {
    await setPrivate(tenant, body?.value === true);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json(await snapshot(tenant));
}
