// People with accounts at a club (lib/auth.ts): who's asked to join, who's been
// approved, and each person's roles. Kept in the club's "people" hash, by
// account id. Whoever signs in with the club's own email (the one it signed up
// with) is its club admin. Server only.
import { randomBytes } from "crypto";
import { COACH_ROLES, MAX_CHILDREN, ROLES, kvCall, peopleKey, readPerson, type Child, type Person, type Role } from "./access";
import { currentUser, userClubsKey, type User } from "./auth";
import { DEFAULT_TENANT } from "./tenantHost";
import { getTenantRecord } from "./tenants";

export const isRole = (r: unknown): r is Role => typeof r === "string" && r in ROLES;

type TeamRef = { slug: string; name: string };

/** A team from a request, if it's one of the club's. */
export const pickTeam = (slug: unknown, teams: TeamRef[]): TeamRef | undefined =>
  teams.find((t) => t.slug === slug);

/**
 * Children from a request: each with a name (kept short — a first name and
 * initial is plenty) and, if it's one of the club's, a team. Existing ids are
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

/** Change a person's own team, or their children (a parent editing theirs, or a coach fixing them). */
export async function updatePerson(
  tenant: string,
  userId: string,
  change: { team?: TeamRef | null; children?: Child[] },
): Promise<Person | null> {
  const person = await readPerson(tenant, userId);
  if (!person) return null;
  const next: Person = { ...person };
  if (change.team === null) delete next.team;
  else if (change.team) next.team = change.team;
  if (change.children) {
    next.children = change.children;
    // the one child typed before children were listed is now in the list
    delete next.child;
    if (next.relation === "parent") delete next.team;
  }
  await save(tenant, next);
  return next;
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
