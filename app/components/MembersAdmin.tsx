"use client";

// Coach Admin → Members: the club's join code and link, whether only approved
// members can open the hub, and approving (or not) the people who ask to join.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RELATIONS, ROLES, SESSION_KEY, childrenOf, teamsOf, type Member, type Person, type Role } from "@/lib/access";
import ChildrenEditor, { toDrafts, type ChildDraft } from "./ChildrenEditor";
import { keyQuery } from "./coachKey";

type TeamOption = { slug: string; name: string };

type Snapshot = {
  private: boolean;
  code: string;
  joinUrl: string;
  platformJoin: string | null;
  people: Person[];
  members: Member[];
  teams: TeamOption[];
  players: SquadPlayer[];
  invites: { email: string; name?: string; roles: Role[]; team?: TeamOption; invitedBy: string; createdAt: string }[];
  /** a club admin: can give the Club admin, Coach and Treasurer roles, change the code, etc. */
  canAdmin: boolean;
  passwordOff: boolean;
  /** a club admin signed in with their own account (who alone can switch the password off) */
  accountAdmin: boolean;
};

/** The roles only a club admin can give or take away. */
const ADMIN_ROLES: Role[] = ["admin", "coach", "treasurer"];
type SquadPlayer = { id: string; name: string; team: string };

/** The squad player a new child most likely already is: same team, same first name (and surname initial, if given). */
function likelyPlayer(child: { name: string; team?: { slug: string } }, players: SquadPlayer[]): string {
  const [first, ...rest] = child.name.trim().toLowerCase().split(/\s+/);
  const initial = rest.length ? rest[rest.length - 1][0] : "";
  const match = players.find((p) => {
    if (child.team && p.team !== child.team.slug) return false;
    const [pf, ...pr] = p.name.trim().toLowerCase().split(/\s+/);
    return pf === first && (!initial || (pr.length > 0 && pr[pr.length - 1][0] === initial));
  });
  return match?.id ?? "new";
}

/** "Parent or carer of Sam B (Hawks), Max B (Owls) · new this season" */
function describe(m: Pick<Person, "relation" | "child" | "children" | "team" | "note">, inTeam?: string): string {
  // under one team's heading, a parent shows just their children in that team
  const kids = childrenOf(m).filter((c) => !inTeam || c.team?.slug === inTeam);
  if (kids.length) {
    const who = `${m.relation ? RELATIONS[m.relation] : "Parent or carer"} of ${kids
      .map((c) => (c.team ? `${c.name} (${c.team.name})` : c.name))
      .join(", ")}`;
    return [who, m.note].filter(Boolean).join(" · ");
  }
  return [m.relation ? RELATIONS[m.relation] : "", m.team?.name, m.note].filter(Boolean).join(" · ");
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MembersAdmin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (k: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/members?key=${encodeURIComponent(k)}`, { cache: "no-store" });
      if (res.status === 401) throw new Error("Incorrect password");
      if (!res.ok) throw new Error("Could not load the members. Please try again.");
      setSnap(await res.json());
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    let cancelled = false;
    const t = setTimeout(async () => {
      if (urlKey) {
        setKey(urlKey);
        load(urlKey);
        return;
      }
      // a club admin or coach signed in with their account needs no password
      const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!cancelled && me?.canCoach) {
        setKey(SESSION_KEY);
        load(SESSION_KEY);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/members?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      setSnap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  if (!authed || !snap) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mb-2 text-3xl">👪</div>
            <h1 className="text-xl font-extrabold text-gray-900">Members</h1>
            <p className="mt-1 text-sm text-gray-500">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="mb-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={busy || !key}
            className="w-full cursor-pointer rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {busy ? "Loading…" : "Open Members"}
          </button>
          <Link href="/admin" className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700">
            ← Coach Admin
          </Link>
        </div>
      </main>
    );
  }

  const people = snap.people;
  const pending = people.filter((p) => p.status === "pending");
  const approved = people.filter((p) => p.status === "approved");
  const declined = people.filter((p) => p.status === "declined");
  // approved members by team (a parent is under each of their children's teams)
  const groups = [
    ...snap.teams.map((t) => ({ key: t.slug, title: t.name, people: approved.filter((p) => teamsOf(p).includes(t.slug)) })),
    { key: "", title: "No team yet", people: approved.filter((p) => teamsOf(p).length === 0) },
  ].filter((g) => g.people.length);
  // phones approved before accounts (and any still waiting from then)
  const phones = snap.members.filter((m) => m.status !== "declined");
  const card = "mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm";

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-green-700 px-4 py-6 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href={`/admin${keyQuery(key)}`} className="text-sm font-medium text-green-200 hover:text-white">
            ← Coach Admin
          </Link>
          <h1 className="mt-2 text-xl font-extrabold">👪 Members</h1>
          <p className="mt-0.5 text-sm text-green-200">Who can open your club&apos;s hub, and what they can do</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {/* Join code */}
        <section className={card}>
          <h2 className="font-extrabold text-gray-900">🔑 Your Club Code</h2>
          <p className="mt-1 text-sm text-gray-500">
            Give parents, players and coaches this code, or send them the join link. They sign in with
            their email and ask to join; you approve them below.
            {snap.platformJoin && (
              <>
                {" "}They can type the code at <strong>{snap.platformJoin.replace(/^https?:\/\//, "").replace(/\/$/, "")}</strong>.
              </>
            )}
          </p>
          <p className="mt-4 select-all rounded-2xl bg-gray-50 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.2em] text-gray-900">
            {snap.code}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => copy(snap.code, "code")} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
              {copied === "code" ? "Copied ✓" : "Copy Code"}
            </button>
            <button onClick={() => copy(snap.joinUrl, "link")} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
              {copied === "link" ? "Copied ✓" : "Copy Join Link"}
            </button>
            {snap.canAdmin && <button
              onClick={() => {
                if (confirm("Make a new code? The old code and join link stop working; members already approved stay approved.")) act({ action: "newCode" });
              }}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40"
            >
              New Code
            </button>}
          </div>
        </section>

        <InviteSection snap={snap} busy={busy} onAct={act} />

        {/* Private hub */}
        <section className={card}>
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block font-extrabold text-gray-900">🔒 Only approved members</span>
              <span className="mt-1 block text-sm text-gray-500">
                {snap.private
                  ? "On: only people you've approved can open the hub. Anyone else is asked for the club code, signs in and waits for approval."
                  : "Off: anyone with the hub's address can open it. Turn on so only people you approve can see it."}
              </span>
            </span>
            <input
              type="checkbox"
              checked={snap.private}
              disabled={busy || !snap.canAdmin}
              onChange={(e) => {
                const on = e.target.checked;
                if (on && !confirm("Turn on? Everyone apart from coaches will need to ask to join with the club code, and you'll approve them here.")) return;
                act({ action: "private", value: on });
              }}
              className="mt-1 h-6 w-6 shrink-0 accent-green-600"
            />
          </label>
        </section>

        {snap.canAdmin && <PasswordSection snap={snap} busy={busy} onAct={act} />}

        {/* Waiting */}
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-gray-900">⏳ Waiting for Approval {pending.length > 0 && `(${pending.length})`}</h2>
            <button onClick={() => load(key)} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40">
              Refresh
            </button>
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No one is waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {pending.map((p) => (
                <PendingPerson key={p.userId} person={p} players={snap.players} canAdmin={snap.canAdmin} busy={busy} onDecide={act} />
              ))}
            </ul>
          )}
        </section>

        {/* Approved, by team */}
        <section className={card}>
          <h2 className="font-extrabold text-gray-900">✅ Members ({approved.length})</h2>
          <p className="mt-1 text-sm text-gray-500">
            By team. Tap a role to give or take it away — club admins and coaches can use Coach Admin.
          </p>
          {approved.length === 0 && <p className="mt-2 text-sm text-gray-500">No members yet.</p>}
          {groups.map((g) => (
            <details key={g.key || "none"} open className="mt-4 rounded-xl border border-gray-100">
              <summary className="cursor-pointer select-none rounded-xl bg-gray-50 px-4 py-2.5 font-bold text-gray-800">
                {g.title} <span className="font-semibold text-gray-500">({g.people.length})</span>
              </summary>
              <ul className="divide-y divide-gray-100 px-4">
                {g.people.map((p) => (
                  <MemberRow key={p.userId} person={p} inTeam={g.key || undefined} teams={snap.teams} canAdmin={snap.canAdmin} busy={busy} onAct={act} />
                ))}
              </ul>
            </details>
          ))}
        </section>

        {declined.length > 0 && (
          <section className={card}>
            <h2 className="font-extrabold text-gray-900">Declined ({declined.length})</h2>
            <ul className="mt-3 divide-y divide-gray-100">
              {declined.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-900">{p.name}</span>
                    <span className="block text-sm text-gray-500">{[p.email, describe(p)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button onClick={() => act({ action: "removePerson", userId: p.userId })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {phones.length > 0 && (
          <section className={card}>
            <h2 className="font-extrabold text-gray-900">📱 Phones Approved Before Accounts ({phones.length})</h2>
            <p className="mt-1 text-sm text-gray-500">
              These still work. Ask each person to sign in and join with an account, then remove their phone here.
            </p>
            <ul className="mt-3 divide-y divide-gray-100">
              {phones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-900">
                      {m.name}
                      {m.role === "coach" && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">Coach</span>}
                    </span>
                    <span className="block text-sm text-gray-500">{describe(m) || (m.status === "pending" ? "waiting" : "")}</span>
                  </span>
                  <span className="flex gap-3">
                    {m.status === "pending" && (
                      <button onClick={() => act({ action: "approve", id: m.id })} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40">
                        Approve
                      </button>
                    )}
                    <button onClick={() => act({ action: "remove", id: m.id })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40">
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

const ALL_ROLES = Object.keys(ROLES) as Role[];

/** A person's roles as chips to tap on and off. */
function RoleChips({
  roles,
  disabled,
  onChange,
  canAdmin = true,
}: {
  roles: Role[];
  disabled: boolean;
  onChange: (roles: Role[]) => void;
  /** a coach who isn't a club admin can only give (or take away) Parent and Player */
  canAdmin?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {ALL_ROLES.map((r) => {
        const on = roles.includes(r);
        const locked = !canAdmin && ADMIN_ROLES.includes(r);
        return (
          <button
            key={r}
            type="button"
            disabled={disabled || locked}
            title={locked ? "Only a club admin can change this role" : undefined}
            aria-pressed={on}
            onClick={() => onChange(on ? roles.filter((x) => x !== r) : [...roles, r])}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
              on ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {ROLES[r]}
          </button>
        );
      })}
    </div>
  );
}

/** Someone waiting: choose their role(s), then approve or decline. */
function PendingPerson({
  person,
  players,
  canAdmin,
  busy,
  onDecide,
}: {
  person: Person;
  players: SquadPlayer[];
  canAdmin: boolean;
  busy: boolean;
  onDecide: (body: Record<string, unknown>) => void;
}) {
  const kids = childrenOf(person);
  // each child: an existing squad player, or a new one
  const [links, setLinks] = useState<Record<string, string>>(() =>
    Object.fromEntries(kids.map((c) => [c.id, likelyPlayer(c, players)])),
  );
  // someone saying they're a coach starts as a Parent: Coach (which opens
  // Coach Admin) is only given when a coach ticks it on purpose
  const first: Role = person.relation === "player" ? "player" : "parent";
  const [roles, setRoles] = useState<Role[]>([first]);
  return (
    <li className="py-3">
      <span className="block font-bold text-gray-900">{person.name}</span>
      <span className="block text-sm text-gray-500">{[person.email, describe(person), `asked ${when(person.createdAt)}`].filter(Boolean).join(" · ")}</span>
      {person.relation === "coach" && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Says they&apos;re a coach. Only give the <strong>Coach</strong> role if you know them — it opens Coach Admin.
        </p>
      )}
      {kids.length > 0 && (
        <div className="mt-2 rounded-lg bg-gray-50 p-2">
          <p className="text-xs font-semibold text-gray-500">Their children in your squad:</p>
          {kids.map((c) => (
            <label key={c.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-800">
              <span className="min-w-0 flex-1 font-semibold">
                {c.name}
                {c.team && <span className="font-normal text-gray-500"> · {c.team.name}</span>}
              </span>
              <select
                value={links[c.id] ?? "new"}
                onChange={(e) => setLinks({ ...links, [c.id]: e.target.value })}
                aria-label={`Squad player for ${c.name}`}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="new">Add as a new player</option>
                {players
                  .filter((pl) => !c.team || pl.team === c.team.slug)
                  .map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      Is {pl.name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-gray-500">Approve as:</p>
      <RoleChips roles={roles} disabled={busy} onChange={setRoles} canAdmin={canAdmin} />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onDecide({ action: "approvePerson", userId: person.userId, roles, links })}
          disabled={busy || !roles.length}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
        >
          Approve
        </button>
        <button onClick={() => onDecide({ action: "declinePerson", userId: person.userId })} disabled={busy} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          Decline
        </button>
      </div>
    </li>
  );
}

/** An approved member: their details and roles, and fixing their team (or their children's). */
function MemberRow({
  person,
  inTeam,
  teams,
  canAdmin,
  busy,
  onAct,
}: {
  person: Person;
  inTeam?: string;
  teams: TeamOption[];
  canAdmin: boolean;
  busy: boolean;
  onAct: (body: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isParent = person.relation === "parent" || childrenOf(person).length > 0;
  const [kids, setKids] = useState<ChildDraft[]>(() => {
    const now = toDrafts(childrenOf(person));
    return now.length ? now : [{ name: "", team: "" }];
  });
  const [team, setTeam] = useState(person.team?.slug ?? "");

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-gray-900">{person.name}</span>
          <span className="block text-sm text-gray-500">{[person.email, describe(person, inTeam)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex gap-3">
          <button onClick={() => setEditing(!editing)} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40">
            {editing ? "Close" : "Edit"}
          </button>
          {(canAdmin || !person.roles.some((r) => ADMIN_ROLES.includes(r))) && (
            <button
              onClick={() => {
                if (confirm(`Remove ${person.name}? They won't be able to open the hub until they ask again.`)) onAct({ action: "removePerson", userId: person.userId });
              }}
              disabled={busy}
              className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </span>
      </div>
      <RoleChips
        roles={person.roles}
        disabled={busy || (!canAdmin && person.roles.some((r) => ADMIN_ROLES.includes(r)))}
        canAdmin={canAdmin}
        onChange={(roles) => roles.length && onAct({ action: "personRoles", userId: person.userId, roles })}
      />
      {editing && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          {isParent ? (
            <>
              <p className="mb-2 text-xs font-semibold text-gray-600">Their children and teams</p>
              <ChildrenEditor value={kids} teams={teams} onChange={setKids} />
            </>
          ) : (
            <label className="block text-xs font-semibold text-gray-600">
              Team
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => {
              onAct(
                isParent
                  ? { action: "editPerson", userId: person.userId, children: kids.filter((k) => k.name.trim()) }
                  : { action: "editPerson", userId: person.userId, team },
              );
              setEditing(false);
            }}
            disabled={busy}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
    </li>
  );
}

/** Invite someone by email: signing in with that email makes them a member, with the roles chosen here. */
function InviteSection({ snap, busy, onAct }: { snap: Snapshot; busy: boolean; onAct: (body: Record<string, unknown>) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["coach"]);
  const [team, setTeam] = useState("");
  const shownRoles = snap.canAdmin ? roles : roles.filter((r) => !ADMIN_ROLES.includes(r));
  const field = "rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-gray-900">✉️ Invite by Email</h2>
      <p className="mt-1 text-sm text-gray-500">
        For your coaches and helpers: they get an email, sign in with that address, and they&apos;re straight in
        with the roles you choose — no code or approval needed.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className={field} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" maxLength={60} className={field} />
        {snap.teams.length > 0 && (
          <select value={team} onChange={(e) => setTeam(e.target.value)} className={field}>
            <option value="">Team (optional)</option>
            {snap.teams.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        )}
      </div>
      <RoleChips roles={shownRoles} disabled={busy} onChange={setRoles} canAdmin={snap.canAdmin} />
      <button
        onClick={() => {
          onAct({ action: "invite", email, name, roles: shownRoles, team });
          setEmail("");
          setName("");
        }}
        disabled={busy || !email.includes("@") || !shownRoles.length}
        className="mt-3 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
      >
        Send Invite
      </button>
      {snap.invites.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
          {snap.invites.map((i) => (
            <li key={i.email} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900">{i.name || i.email}</span>
                <span className="block text-sm text-gray-500">
                  {[i.name ? i.email : "", i.roles.map((r) => ROLES[r]).join(", "), i.team?.name, `invited ${when(i.createdAt)}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              {(snap.canAdmin || !i.roles.some((r) => ADMIN_ROLES.includes(r))) && (
                <button onClick={() => onAct({ action: "cancelInvite", email: i.email })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40">
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The club's shared coach password: on (still works) or off (everyone signs in with their own account). */
function PasswordSection({ snap, busy, onAct }: { snap: Snapshot; busy: boolean; onAct: (body: Record<string, unknown>) => void }) {
  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-gray-900">🔑 Shared Coach Password</h2>
      <p className="mt-1 text-sm text-gray-500">
        {snap.passwordOff
          ? "Off: everyone signs in with their own account. Nobody can get in with a shared password."
          : "On: anyone with the club's coach password can still use Coach Admin. Once your coaches have their own accounts, switch it off — then removing someone from Members takes away their access straight away."}
      </p>
      {snap.accountAdmin ? (
        <button
          onClick={() => {
            if (snap.passwordOff || confirm("Switch the shared coach password off? Only people with their own account and the Club admin or Coach role will be able to use Coach Admin.")) {
              onAct({ action: "password", off: !snap.passwordOff });
            }
          }}
          disabled={busy}
          className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${
            snap.passwordOff ? "border border-gray-200 text-gray-700 hover:bg-gray-50" : "bg-gray-900 text-white hover:bg-black"
          }`}
        >
          {snap.passwordOff ? "Switch the Password Back On" : "Switch the Password Off"}
        </button>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          To change this, sign in with your own club admin account (Coach Admin → Sign In With Your Email).
        </p>
      )}
    </section>
  );
}
