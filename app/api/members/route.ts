// Coach Admin → Members: the club's join code, whether the hub is private, and
// the people who've asked to join or been invited. For club admins and coaches;
// only club admins can give (or take away) the Club admin, Coach and Treasurer
// roles, invite people with them, change the code or who can open the hub, or
// switch the shared coach password off.
//   GET  ?key=…                                   -> { private, code, joinUrl, platformJoin, people, members,
//                                                    invites, canAdmin, passwordOff, accountAdmin }
//   POST ?key=… { action: "approvePerson" | "personRoles", userId, roles, links? }  (people with accounts;
//                                            approving adds a parent's children to the squad — links
//                                            maps a child to an existing squad player instead)
//   POST ?key=… { action: "declinePerson" | "removePerson", userId }
//   POST ?key=… { action: "editPerson", userId, team?, children? }      (fix someone's team or children)
//   POST ?key=… { action: "approve" | "decline" | "remove", id }        (phones approved before accounts)
//   POST ?key=… { action: "newCode" }             -> a new join code (the old one stops working)
//   POST ?key=… { action: "private", value }      -> only approved members can open the hub (or anyone)
//   POST ?key=… { action: "invite", email, roles, team?, name? }  -> emails an invitation; signing in with
//                                                    that email makes them a member with those roles
//   POST ?key=… { action: "cancelInvite", email }
//   POST ?key=… { action: "password", off }       -> switch the shared coach password off (or on); only
//                                                    a club admin signed in with their account
import { NextRequest, NextResponse } from "next/server";
import { SESSION_KEY, readPerson, showCode, type Role } from "@/lib/access";
import { isClubAdmin, isCoach } from "@/lib/adminAuth";
import { EMAIL, cleanEmail } from "@/lib/auth";
import { sendEmail, simpleEmail } from "@/lib/email";
import { decide, getAccess, listMembers, renewCode, setPasswordOff, setPrivate } from "@/lib/members";
import {
  addChildrenToSquad,
  cancelInvite,
  cleanChildren,
  createInvite,
  currentPerson,
  decidePerson,
  isRole,
  listInvites,
  listPeople,
  pickTeam,
  updatePerson,
} from "@/lib/people";
import { getClub } from "@/lib/settings";
import { listPlayers } from "@/lib/statsStorage";
import { getTeams } from "@/lib/settings";
import { DEFAULT_TENANT, PLATFORM_NAME, platformUrl, requireTenant, rootDomain, tenantUrl } from "@/lib/tenant";

/** Roles only a club admin can give or take away. */
const ADMIN_ROLES: Role[] = ["admin", "coach", "treasurer"];
const privileged = (roles: Role[]) => roles.some((r) => ADMIN_ROLES.includes(r));
const adminsOnly = () =>
  NextResponse.json({ error: "Only a club admin can do that — ask one of your club admins" }, { status: 403 });

export const dynamic = "force-dynamic";

async function snapshot(tenant: string, key: string) {
  const [access, members, people, teams, players, invites, canAdmin, me] = await Promise.all([
    getAccess(tenant),
    listMembers(tenant),
    listPeople(tenant),
    getTeams(),
    listPlayers(),
    listInvites(tenant),
    isClubAdmin(key),
    currentPerson(tenant).catch(() => null),
  ]);
  return {
    canAdmin,
    passwordOff: !!access.passwordOff,
    // switching the password off needs a club admin signed in with an account, so they can't lock themselves out
    accountAdmin: key === SESSION_KEY && !!me?.person?.roles.includes("admin"),
    invites,
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
  return NextResponse.json(await snapshot(await requireTenant(), req.nextUrl.searchParams.get("key") ?? ""));
}

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!(await isCoach(key))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const tenant = await requireTenant();
  const canAdmin = await isClubAdmin(key);
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
    // a coach can look after parents and players; anything to do with admins, coaches and treasurers is for club admins
    if (!canAdmin) {
      const target = await readPerson(tenant, userId);
      if (privileged(roles) || privileged(target?.roles ?? [])) return adminsOnly();
    }
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
    if (!canAdmin) return adminsOnly();
    await renewCode(tenant);
  } else if (action === "private") {
    if (!canAdmin) return adminsOnly();
    await setPrivate(tenant, body?.value === true);
  } else if (action === "invite") {
    const email = cleanEmail(body?.email);
    const roles = Array.isArray(body?.roles) ? body.roles.filter(isRole) : [];
    if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    if (!roles.length) return NextResponse.json({ error: "Choose at least one role" }, { status: 400 });
    if (!canAdmin && privileged(roles)) return adminsOnly();
    const teams = (await getTeams()).map((t) => ({ slug: t.slug, name: t.name }));
    const team = pickTeam(body?.team, teams);
    const me = await currentPerson(tenant).catch(() => null);
    const club = await getClub();
    const invitedBy = me?.person?.name || me?.user.name || `${club.name}'s coaches`;
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
    await createInvite(tenant, {
      email,
      ...(name ? { name } : {}),
      roles,
      ...(team ? { team } : {}),
      invitedBy,
      createdAt: new Date().toISOString(),
    });
    const toCoachAdmin = privileged(roles);
    await sendEmail({
      to: email,
      subject: `You're invited to ${club.name} on ${PLATFORM_NAME}`,
      ...simpleEmail({
        heading: `Join ${club.name}`,
        paragraphs: [
          `${invitedBy} has invited you to ${club.name}'s team hub${team ? ` (${team.name})` : ""}.`,
          "Tap the button and sign in with this email address — we'll send you a code, there's no password. You'll be straight in.",
        ],
        button: { label: toCoachAdmin ? "Open Coach Admin" : "Open the Hub", url: tenantUrl(tenant, `/signin?next=${toCoachAdmin ? "/admin" : "/"}`) },
        footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
      }),
    });
  } else if (action === "cancelInvite") {
    const email = cleanEmail(body?.email);
    const invite = (await listInvites(tenant)).find((i) => i.email === email);
    if (invite && !canAdmin && privileged(invite.roles)) return adminsOnly();
    await cancelInvite(tenant, email);
  } else if (action === "password") {
    const me = await currentPerson(tenant).catch(() => null);
    if (key !== SESSION_KEY || !me?.person?.roles.includes("admin")) {
      return NextResponse.json({ error: "Sign in with your own club admin account to change this" }, { status: 403 });
    }
    await setPasswordOff(tenant, body?.off === true);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json(await snapshot(tenant, key));
}
