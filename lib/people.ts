// People with accounts at a club (lib/auth.ts): who's asked to join, who's been
// approved, and each person's roles. Kept in the club's "people" hash, by
// account id. Whoever signs in with the club's own email (the one it signed up
// with) is its club admin. Server only.
import { randomBytes } from "crypto";
import {
  COACH_ROLES,
  MAX_CHILDREN,
  ROLES,
  childrenOf,
  invitesKey,
  kvCall,
  peopleKey,
  readPerson,
  type Child,
  type Person,
  type Role,
} from "./access";
import { getTeams } from "./settings";
import { addPlayer, deletePlayer, listPlayers, setPlayerTeam } from "./statsStorage";
import { currentUser, userClubsKey, type User } from "./auth";
import { DEFAULT_TENANT } from "./tenantHost";
import { getTenantRecord } from "./tenants";

export const isRole = (r: unknown): r is Role => typeof r === "string" && r in ROLES;

type TeamRef = { slug: string; name: string };

/** A team from a request, if it's one of the club's. */
export const pickTeam = (slug: unknown, teams: TeamRef[]): TeamRef | undefined =>
  teams.find((t) => t.slug === slug);

/**
 * Children from a request: each with their name (their full name, for the
 * club's squad) and, if it's one of the club's, a team. Existing ids are
 * kept, so a child stays the same child when a parent edits them.
 */
export function cleanChildren(input: unknown, teams: TeamRef[]): Child[] {
  if (!Array.isArray(input)) return [];
  const out: Child[] = [];
  for (const raw of input.slice(0, MAX_CHILDREN)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
    if (!name) continue;
    const id = typeof r.id === "string" && /^[\w-]{1,24}$/.test(r.id) ? r.id : randomBytes(6).toString("base64url");
    const team = pickTeam(r.team, teams);
    out.push({ id, name, ...(team ? { team } : {}) });
  }
  return out;
}

async function save(tenant: string, person: Person): Promise<void> {
  await kvCall(["HSET", peopleKey(tenant), person.userId, JSON.stringify(person)]);
  await kvCall(["SADD", userClubsKey(person.userId), tenant]);
}

/**
 * `user`'s place at `tenant`, if they have one. The club's own email is made
 * its club admin the first time it signs in.
 */
export async function personFor(tenant: string, user: User): Promise<Person | null> {
  const person = await readPerson(tenant, user.id);
  if (person?.status === "approved" && person.roles.includes("admin")) return person;
  if (tenant !== DEFAULT_TENANT) {
    const record = await getTenantRecord(tenant);
    if (record && record.email.toLowerCase() === user.email) {
      const now = new Date().toISOString();
      const owner: Person = {
        ...(person ?? { createdAt: now }),
        userId: user.id,
        name: person?.name || user.name || "Club admin",
        email: user.email,
        roles: [...new Set<Role>(["admin", ...(person?.roles ?? [])])],
        status: "approved",
        decidedAt: now,
      };
      await save(tenant, owner);
      return owner;
    }
  }
  // invited by email: in, with the invited roles (even if they'd already asked to join)
  if (person?.status !== "approved") return (await redeemInvite(tenant, user, person)) ?? person;
  return person;
}

/** Someone a club admin invited by email, waiting to sign in. */
export type Invite = { email: string; name?: string; roles: Role[]; team?: TeamRef; invitedBy: string; createdAt: string };

const parseInvite = (v: unknown): Invite | null => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as Invite;
  } catch {
    return null;
  }
};

export async function createInvite(tenant: string, invite: Invite): Promise<void> {
  await kvCall(["HSET", invitesKey(tenant), invite.email, JSON.stringify(invite)]);
}

export async function listInvites(tenant: string): Promise<Invite[]> {
  const flat = (await kvCall<string[]>(["HGETALL", invitesKey(tenant)])) ?? [];
  const out: Invite[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    const inv = parseInvite(flat[i]);
    if (inv) out.push(inv);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function cancelInvite(tenant: string, email: string): Promise<void> {
  await kvCall(["HDEL", invitesKey(tenant), email]);
}

/** The first time an invited person signs in: they're in, with the roles they were invited with. */
async function redeemInvite(tenant: string, user: User, existing: Person | null): Promise<Person | null> {
  const invite = parseInvite(await kvCall(["HGET", invitesKey(tenant), user.email]));
  if (!invite) return null;
  const now = new Date().toISOString();
  const person: Person = {
    ...(existing ?? {}),
    userId: user.id,
    email: user.email,
    name: existing?.name || user.name || invite.name || user.email.split("@")[0],
    roles: invite.roles,
    status: "approved",
    ...(invite.team ? { team: invite.team } : {}),
    note: `Invited by ${invite.invitedBy}`,
    createdAt: existing?.createdAt ?? now,
    decidedAt: now,
  };
  await save(tenant, person);
  await cancelInvite(tenant, user.email);
  // a parent who'd already listed children: they join the squad, as on any approval
  if (childrenOf(person).length) {
    await addChildrenToSquad(tenant, user.id, {});
    return (await readPerson(tenant, user.id)) ?? person;
  }
  return person;
}

/** The signed-in person at `tenant`, with their account. */
export async function currentPerson(tenant: string): Promise<{ user: User; person: Person | null } | null> {
  const user = await currentUser();
  return user ? { user, person: await personFor(tenant, user) } : null;
}

export const canCoach = (p: Person | null) => p?.status === "approved" && p.roles.some((r) => COACH_ROLES.includes(r));

/** A signed-in person asking to join. Someone already approved stays as they are. */
export async function requestToJoinAsPerson(
  tenant: string,
  user: User,
  details: Pick<Person, "name" | "relation" | "team" | "children" | "note">,
): Promise<Person> {
  const existing = await personFor(tenant, user);
  if (existing?.status === "approved") return existing;
  const person: Person = {
    userId: user.id,
    email: user.email,
    name: details.name,
    roles: [],
    status: "pending",
    ...(details.relation ? { relation: details.relation } : {}),
    ...(details.team ? { team: details.team } : {}),
    ...(details.children?.length ? { children: details.children } : {}),
    ...(details.note ? { note: details.note } : {}),
    createdAt: new Date().toISOString(),
  };
  await save(tenant, person);
  return person;
}

export async function listPeople(tenant: string): Promise<Person[]> {
  const flat = (await kvCall<string[]>(["HGETALL", peopleKey(tenant)])) ?? [];
  const out: Person[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i + 1]) as Person);
    } catch {}
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A coach's decision: approve (with roles), change roles, decline or remove. */
export async function decidePerson(
  tenant: string,
  userId: string,
  action: "approve" | "roles" | "decline" | "remove",
  roles: Role[] = [],
): Promise<boolean> {
  const person = await readPerson(tenant, userId);
  if (!person) return false;
  if (action === "remove") {
    await leaveClub(tenant, userId);
    return true;
  }
  const now = new Date().toISOString();
  if (action === "decline") await save(tenant, { ...person, status: "declined", roles: [], decidedAt: now });
  else await save(tenant, { ...person, status: "approved", roles: [...new Set(roles)], decidedAt: now });
  return true;
}

/**
 * Change a person's own team, or their children — a parent editing theirs, or a
 * coach fixing them. A child who's already a squad player keeps the team the
 * club gave them (only a coach can change it, and that moves the player too);
 * a new child of an approved parent joins the squad with no team yet, and the
 * team the parent chose waiting as a request.
 */
export async function updatePerson(
  tenant: string,
  userId: string,
  change: { team?: TeamRef | null; children?: Child[] },
  opts: { byCoach?: boolean } = {},
): Promise<Person | null> {
  const person = await readPerson(tenant, userId);
  if (!person) return null;
  const next: Person = { ...person };
  if (change.team === null) delete next.team;
  else if (change.team) next.team = change.team;
  if (change.children) {
    const before = new Map(childrenOf(person).map((c) => [c.id, c]));
    const out: Child[] = [];
    for (const c of change.children) {
      const old = before.get(c.id);
      if (old?.playerId) {
        let team = old.team;
        if (opts.byCoach && c.team?.slug !== old.team?.slug) {
          await setPlayerTeam(old.playerId, c.team?.slug ?? "");
          team = c.team;
        }
        out.push({ id: old.id, name: c.name, playerId: old.playerId, ...(team ? { team } : {}) });
      } else if (person.status === "approved") {
        const team = opts.byCoach ? c.team : undefined;
        const { player } = await addPlayer({ team: team?.slug ?? "", name: c.name });
        out.push({
          id: c.id,
          name: c.name,
          playerId: player.id,
          ...(team ? { team } : {}),
          ...(!opts.byCoach && c.team ? { requestedTeam: c.team } : {}),
        });
      } else {
        // still waiting for approval: their team is the parent's request
        out.push({ id: c.id, name: c.name, ...(c.team ? { team: c.team } : {}) });
      }
    }
    next.children = out;
    // the one child typed before children were listed is now in the list
    delete next.child;
    if (next.relation === "parent") delete next.team;
  }
  await save(tenant, next);
  return next;
}

/**
 * A just-approved parent's children join the club's squad: each linked to the
 * squad player the coach picked (`links`: child id → player id), or added as a
 * new player in the team the parent chose.
 */
export async function addChildrenToSquad(tenant: string, userId: string, links: Record<string, string>): Promise<void> {
  const person = await readPerson(tenant, userId);
  if (!person) return;
  const kids = childrenOf(person);
  if (!kids.length || kids.every((c) => c.playerId)) return;
  const [players, teams] = await Promise.all([listPlayers(), getTeams()]);
  const teamRef = (slug: string) => {
    const t = teams.find((x) => x.slug === slug);
    return t ? { slug: t.slug, name: t.name } : undefined;
  };
  const out: Child[] = [];
  for (const c of kids) {
    if (c.playerId) {
      out.push(c);
      continue;
    }
    const existing = players.find((p) => p.id === links[c.id]);
    if (existing) {
      const team = teamRef(existing.team);
      out.push({ id: c.id, name: c.name, playerId: existing.id, ...(team ? { team } : {}) });
    } else {
      const { player } = await addPlayer({ team: c.team?.slug ?? "", name: c.name });
      out.push({ id: c.id, name: c.name, playerId: player.id, ...(c.team ? { team: c.team } : {}) });
    }
  }
  const next: Person = { ...person, children: out };
  delete next.child;
  await save(tenant, next);
}

/** Take a player out of the squad, and off their parents' lists of children. */
export async function deleteSquadPlayer(tenant: string, playerId: string): Promise<void> {
  await deletePlayer(playerId);
  for (const person of await listPeople(tenant)) {
    const kids = childrenOf(person);
    if (!kids.some((c) => c.playerId === playerId)) continue;
    const next: Person = { ...person, children: kids.filter((c) => c.playerId !== playerId) };
    delete next.child;
    await save(tenant, next);
  }
}

/** Put a squad player in a team (the club's decision), and update the parent's record to match. */
export async function assignPlayerTeam(tenant: string, playerId: string, slug: string): Promise<boolean> {
  const teams = await getTeams();
  const team = teams.find((t) => t.slug === slug);
  if (slug && !team) return false;
  if (!(await setPlayerTeam(playerId, slug))) return false;
  for (const person of await listPeople(tenant)) {
    const kids = childrenOf(person);
    if (!kids.some((c) => c.playerId === playerId)) continue;
    const children = kids.map((c) => {
      if (c.playerId !== playerId) return c;
      const updated: Child = { id: c.id, name: c.name, playerId };
      if (team) updated.team = { slug: team.slug, name: team.name };
      return updated;
    });
    await save(tenant, { ...person, children });
  }
  return true;
}

export async function leaveClub(tenant: string, userId: string): Promise<void> {
  await kvCall(["HDEL", peopleKey(tenant), userId]);
  await kvCall(["SREM", userClubsKey(userId), tenant]);
}

/**
 * A safe first role for someone being approved, from who they said they are.
 * Never Coach: that opens Coach Admin, so a coach has to give it on purpose.
 */
export function suggestedRole(p: Person): Role {
  return p.relation === "player" ? "player" : "parent";
}
