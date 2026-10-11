"use client";

// Coach Admin → Members: the club's join code and link, whether only approved
// members can open the hub, and approving (or not) the people who ask to join.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { squarePhoto } from "../account/ProfilePhoto";
import { RELATIONS, ROLES, childrenOf, hasOwnTeam, teamsOf, type Member, type Person, type Role } from "@/lib/access";
import ChildrenEditor, { toDrafts, type ChildDraft } from "./ChildrenEditor";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { TopBar } from "./SettingsUI";

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
  /** whether the club has a shared coach password at all (clubs signed up with accounts don't) */
  sharedPassword: boolean;
  /** a club admin signed in with their own account (who alone can switch the password off) */
  accountAdmin: boolean;
};

/** The roles only a club admin can give or take away. */
const ADMIN_ROLES: Role[] = ["admin", "coach", "treasurer"];
type SquadPlayer = {
  id: string;
  name: string;
  team: string;
  position?: "outfield" | "goalkeeper";
  /** their photo's version, if they have one */
  photo?: string;
};

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

/** "Coaches U10 Whites", "Plays for Hawks" — or just the team — for someone's own team, if they have one. */
function ownTeamLine(m: Pick<Person, "relation" | "child" | "children" | "team"> & { roles?: Role[] }): string {
  if (!m.team || !hasOwnTeam(m)) return "";
  if (m.roles?.includes("coach")) return `Coaches ${m.team.name}`;
  if (m.roles?.includes("player")) return `Plays for ${m.team.name}`;
  return m.team.name;
}

/**
 * "Parent or carer of Sam B (Hawks), Max B (Owls) · new this season". Under one
 * team's heading, it says why they're under it: a parent who also coaches shows
 * "Coaches U10 Whites · also parent of Cian (U10 Greens)" under the team they
 * coach, and their children under their children's team.
 */
function describe(m: Pick<Person, "relation" | "child" | "children" | "team" | "note"> & { roles?: Role[] }, inTeam?: string): string {
  const parentOf = (kids: ReturnType<typeof childrenOf>) =>
    `${m.relation ? RELATIONS[m.relation] : "Parent or carer"} of ${kids.map((c) => (c.team ? `${c.name} (${c.team.name})` : c.name)).join(", ")}`;
  const own = ownTeamLine(m);
  const allKids = childrenOf(m);
  // under the team they coach (or play for)
  if (inTeam && own && m.team?.slug === inTeam) {
    const elsewhere = allKids.filter((c) => c.team?.slug !== inTeam);
    const here = allKids.filter((c) => c.team?.slug === inTeam);
    return [own, here.length ? `also ${parentOf(here).replace(/^\w/, (x) => x.toLowerCase())}` : "", elsewhere.length ? `also ${parentOf(elsewhere).replace(/^\w/, (x) => x.toLowerCase())}` : "", m.note]
      .filter(Boolean)
      .join(" · ");
  }
  // under one team's heading, a parent shows just their children in that team
  const kids = allKids.filter((c) => !inTeam || c.team?.slug === inTeam);
  if (kids.length) {
    return [parentOf(kids), own ? `also ${own.replace(/^\w/, (x) => x.toLowerCase())}` : "", m.note].filter(Boolean).join(" · ");
  }
  return [m.relation ? RELATIONS[m.relation] : "", m.team?.name, m.note].filter(Boolean).join(" · ");
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MembersAdmin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  // a coach password that worked here opens every other tool too
  useEffect(() => {
    if (authed) rememberCoachKey(key);
  }, [authed, key]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // the player whose profile is open
  const [profile, setProfile] = useState<string | null>(null);

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
    // opened from Search (or the old Players page): start filtered to what was found
    const urlQuery = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser
    if (urlQuery) setSearch(urlQuery);
    let cancelled = false;
    const t = setTimeout(async () => {
      if (urlKey) {
        setKey(urlKey);
        await load(urlKey);
        setChecking(false);
        return;
      }
      // signed in with an account, or the coach password given earlier: no password box
      const k = await accountKey();
      if (!cancelled && k) {
        setKey(k);
        await load(k);
      }
      if (!cancelled) setChecking(false);
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
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl dark:bg-[#1c1c1e]">
          <div className="mb-6 text-center">
            <div className="mb-2 text-3xl">👪</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Members</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="mb-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
          />
          {error && <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={busy || !key}
            className="w-full cursor-pointer rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {busy ? "Loading…" : "Open Members"}
          </button>
          <Link href="/admin" className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400">
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
  // like Spond: a child is the member, with their parents (guardians) under them; coaches and
  // staff are listed in their own right — so a parent who coaches is a coach in one place and a
  // guardian in another, never two "people"
  const q = search.trim().toLowerCase();
  const hit = (...texts: (string | undefined)[]) => !q || texts.some((t) => t?.toLowerCase().includes(q));
  const guardiansOf = new Map<string, Person[]>();
  const unmatched: { person: Person; child: ReturnType<typeof childrenOf>[number] }[] = [];
  for (const p of approved) {
    for (const c of childrenOf(p)) {
      if (c.playerId) guardiansOf.set(c.playerId, [...(guardiansOf.get(c.playerId) ?? []), p]);
      else unmatched.push({ person: p, child: c });
    }
  }
  const isStaff = (p: Person) => p.roles.some((r) => ADMIN_ROLES.includes(r));
  const ownTeamSlug = (p: Person) => (hasOwnTeam(p) && p.team && snap.teams.some((t) => t.slug === p.team!.slug) ? p.team.slug : "");
  const personHit = (p: Person) => hit(p.name, p.email);
  const clubWide = approved.filter((p) => isStaff(p) && !ownTeamSlug(p) && personHit(p));
  const teamGroups = [...snap.teams, { slug: "", name: "No Team Yet" }]
    .map((t) => ({
      ...t,
      staff: t.slug ? approved.filter((p) => isStaff(p) && ownTeamSlug(p) === t.slug && personHit(p)) : [],
      squad: snap.players
        .filter((pl) => (snap.teams.some((x) => x.slug === pl.team) ? pl.team : "") === t.slug)
        .filter((pl) => hit(pl.name, ...(guardiansOf.get(pl.id) ?? []).flatMap((g) => [g.name, g.email]))),
      // anyone else with this as their own team (a player's own account), or — under No Team Yet — with no team at all
      others: approved.filter(
        (p) =>
          !isStaff(p) &&
          personHit(p) &&
          (t.slug ? ownTeamSlug(p) === t.slug : teamsOf(p).length === 0 && !childrenOf(p).length),
      ),
    }))
    .filter((g) => g.staff.length || g.squad.length || g.others.length);
  const openPlayer = profile ? snap.players.find((pl) => pl.id === profile) ?? null : null;
  // everyone not listed as staff or another member: parents and carers, listed with their children,
  // so an account never seems to disappear (it's also under each child's profile)
  const listed = new Set([...clubWide, ...teamGroups.flatMap((g) => [...g.staff, ...g.others])].map((p) => p.userId));
  const carers = approved
    .filter((p) => !listed.has(p.userId) && personHit(p))
    .sort((a, b) => a.name.localeCompare(b.name));
  /** What a coach or staff member does, and whose guardian they are. */
  const staffLine = (p: Person) => {
    const role = p.roles.includes("admin") ? "Club admin" : p.roles.includes("coach") ? "Coach" : p.roles.includes("treasurer") ? "Treasurer" : p.roles.includes("player") ? "Player" : "";
    const kids = childrenOf(p);
    return [
      p.email,
      [role, ownTeamSlug(p) ? p.team!.name : ""].filter(Boolean).join(" · "),
      kids.length ? `Guardian of ${kids.map((c) => (c.team ? `${c.name} (${c.team.name})` : c.name)).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  // moving a player to another team, or taking them out of the squad (the Players API)
  async function playerAction(change: PlayerChange) {
    setBusy(true);
    setError(null);
    try {
      const res =
        "remove" in change
          ? await fetch(`/api/players?key=${encodeURIComponent(key)}&id=${encodeURIComponent(change.remove)}`, { method: "DELETE" })
          : await fetch(`/api/players?key=${encodeURIComponent(key)}`, {
              method: "edit" in change ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify("edit" in change ? change.edit : change),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      await load(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
      setBusy(false);
    }
  }
  // phones approved before accounts (and any still waiting from then)
  const phones = snap.members.filter((m) => m.status !== "declined");
  const card = "mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:bg-[#1c1c1e] dark:border-white/10";

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50 pb-16">
      <TopBar title="Members" href={`/admin${keyQuery(key)}`} />

      <div className="mx-auto max-w-2xl px-4">
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}

        {/* Join code */}
        <section className={card}>
          <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🔑 Your Club Code</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Give parents, players and coaches this code, or send them the join link. They sign in with
            their email and ask to join; you approve them below.
            {snap.platformJoin && (
              <>
                {" "}They can type the code at <strong>{snap.platformJoin.replace(/^https?:\/\//, "").replace(/\/$/, "")}</strong>.
              </>
            )}
          </p>
          <p className="mt-4 select-all rounded-2xl bg-gray-50 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.2em] text-gray-900 dark:bg-white/5 dark:text-gray-50">
            {snap.code}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => copy(snap.code, "code")} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15">
              {copied === "code" ? "Copied ✓" : "Copy Code"}
            </button>
            <button onClick={() => copy(snap.joinUrl, "link")} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15">
              {copied === "link" ? "Copied ✓" : "Copy Join Link"}
            </button>
            {snap.canAdmin && <button
              onClick={() => {
                if (confirm("Make a new code? The old code and join link stop working; members already approved stay approved.")) act({ action: "newCode" });
              }}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400"
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
              <span className="block font-extrabold text-gray-900 dark:text-gray-50">🔒 Only approved members</span>
              <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
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

        {snap.canAdmin && snap.sharedPassword && <PasswordSection snap={snap} busy={busy} onAct={act} />}

        {/* Waiting */}
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-gray-900 dark:text-gray-50">⏳ Waiting for Approval {pending.length > 0 && `(${pending.length})`}</h2>
            <button onClick={() => load(key)} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40 dark:text-green-400">
              Refresh
            </button>
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No one is waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {pending.map((p) => (
                <PendingPerson key={p.userId} person={p} players={snap.players} canAdmin={snap.canAdmin} busy={busy} onDecide={act} />
              ))}
            </ul>
          )}
        </section>

        {/* Approved: like Spond — each team's coaches and staff, then its players with their guardians */}
        <section className={card}>
          <h2 className="font-extrabold text-gray-900 dark:text-gray-50">✅ Members</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Each team&apos;s coaches and staff, then its players with their parents or carers (guardians). Tap a role to give
            or take it away — club admins and coaches can use Coach Admin.
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players, parents or coaches"
            className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15"
          />
          {approved.length === 0 && snap.players.length === 0 && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No members yet.</p>}

          {/* children not yet in the squad */}
          {unmatched.length > 0 && !q && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
              <p className="font-bold text-amber-900 dark:text-amber-200">To Add to the Squad ({unmatched.length})</p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">Children of approved parents who aren&apos;t a squad player yet.</p>
              <ul className="mt-2 divide-y divide-amber-200/60 dark:divide-amber-400/20">
                {unmatched.map(({ person, child }) => (
                  <li key={`${person.userId}:${child.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 text-sm text-amber-900 dark:text-amber-100">
                      <span className="font-bold">{child.name}</span>
                      {child.team ? ` · ${child.team.name}` : " · no team yet"} · child of {person.name}
                    </span>
                    <button
                      onClick={() => act({ action: "editPerson", userId: person.userId, children: toDrafts(childrenOf(person)).map((d) => ({ id: d.id, name: d.name, team: d.team })) })}
                      disabled={busy}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
                    >
                      Add to Squad
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* club-wide: admins and coaches with no one team */}
          {clubWide.length > 0 && (
            <details open className="mt-4 rounded-xl border border-gray-100 dark:border-white/10">
              <summary className="cursor-pointer select-none rounded-xl bg-gray-50 px-4 py-2.5 font-bold text-gray-800 dark:bg-white/5 dark:text-gray-100">
                Club-Wide Staff <span className="font-semibold text-gray-500 dark:text-gray-400">({clubWide.length})</span>
              </summary>
              <ul className="divide-y divide-gray-100 px-4 dark:divide-white/10">
                {clubWide.map((p) => (
                  <MemberRow key={p.userId} person={p} note={staffLine(p)} teams={snap.teams} canAdmin={snap.canAdmin} busy={busy} onAct={act} />
                ))}
              </ul>
            </details>
          )}

          {teamGroups.map((g) => (
            <details key={g.slug || "none"} open className="mt-4 rounded-xl border border-gray-100 dark:border-white/10">
              <summary className="cursor-pointer select-none rounded-xl bg-gray-50 px-4 py-2.5 font-bold text-gray-800 dark:bg-white/5 dark:text-gray-100">
                {g.name}{" "}
                <span className="font-semibold text-gray-500 dark:text-gray-400">
                  ({g.squad.length} player{g.squad.length === 1 ? "" : "s"}
                  {g.staff.length ? `, ${g.staff.length} staff` : ""})
                </span>
              </summary>
              <div className="px-4 pb-2">
                {g.staff.length > 0 && (
                  <>
                    <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Coaches & Staff</p>
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                      {g.staff.map((p) => (
                        <MemberRow key={p.userId} person={p} note={staffLine(p)} teams={snap.teams} canAdmin={snap.canAdmin} busy={busy} onAct={act} />
                      ))}
                    </ul>
                  </>
                )}
                {g.squad.length > 0 && (
                  <>
                    <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Players</p>
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                      {g.squad.map((pl) => (
                        <PlayerRow key={pl.id} player={pl} guardians={guardiansOf.get(pl.id) ?? []} adminKey={key} onOpen={() => setProfile(pl.id)} />
                      ))}
                    </ul>
                  </>
                )}
                {g.others.length > 0 && (
                  <>
                    <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Other Members</p>
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                      {g.others.map((p) => (
                        <MemberRow key={p.userId} person={p} note={staffLine(p)} teams={snap.teams} canAdmin={snap.canAdmin} busy={busy} onAct={act} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </details>
          ))}
          {carers.length > 0 && (
            <details open={!!q} className="mt-4 rounded-xl border border-gray-100 dark:border-white/10">
              <summary className="cursor-pointer select-none rounded-xl bg-gray-50 px-4 py-2.5 font-bold text-gray-800 dark:bg-white/5 dark:text-gray-100">
                Parents & Carers <span className="font-semibold text-gray-500 dark:text-gray-400">({carers.length})</span>
              </summary>
              <ul className="divide-y divide-gray-100 px-4 dark:divide-white/10">
                {carers.map((p) => {
                  const kids = childrenOf(p);
                  return (
                    <MemberRow
                      key={p.userId}
                      person={p}
                      note={[
                        p.email,
                        kids.length
                          ? `${p.relation && p.relation !== "parent" ? RELATIONS[p.relation] : "Guardian"} of ${kids.map((c) => (c.team ? `${c.name} (${c.team.name})` : c.name)).join(", ")}`
                          : "No children added yet",
                      ].join(" · ")}
                      teams={snap.teams}
                      canAdmin={snap.canAdmin}
                      busy={busy}
                      onAct={act}
                    />
                  );
                })}
              </ul>
            </details>
          )}
          {openPlayer && (
            <PlayerProfile
              player={openPlayer}
              guardians={guardiansOf.get(openPlayer.id) ?? []}
              snap={snap}
              adminKey={key}
              busy={busy}
              onAct={act}
              onPlayer={playerAction}
              onPhoto={() => load(key)}
              onClose={() => setProfile(null)}
            />
          )}
          {q && !teamGroups.length && !clubWide.length && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No one matches “{search.trim()}”.</p>}
        </section>

        {declined.length > 0 && (
          <section className={card}>
            <h2 className="font-extrabold text-gray-900 dark:text-gray-50">Declined ({declined.length})</h2>
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {declined.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-900 dark:text-gray-50">{p.name}</span>
                    <span className="block text-sm text-gray-500 dark:text-gray-400">{[p.email, describe(p)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button onClick={() => act({ action: "removePerson", userId: p.userId })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {phones.length > 0 && (
          <section className={card}>
            <h2 className="font-extrabold text-gray-900 dark:text-gray-50">📱 Phones Approved Before Accounts ({phones.length})</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              These still work. Ask each person to sign in and join with an account, then remove their phone here.
            </p>
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {phones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-900 dark:text-gray-50">
                      {m.name}
                      {m.role === "coach" && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-300 dark:bg-white/10">Coach</span>}
                    </span>
                    <span className="block text-sm text-gray-500 dark:text-gray-400">{describe(m) || (m.status === "pending" ? "waiting" : "")}</span>
                  </span>
                  <span className="flex gap-3">
                    {m.status === "pending" && (
                      <button onClick={() => act({ action: "approve", id: m.id })} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40 dark:text-green-400">
                        Approve
                      </button>
                    )}
                    <button onClick={() => act({ action: "remove", id: m.id })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400">
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
              on ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:bg-white/10 dark:hover:bg-white/15"
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
      <span className="block font-bold text-gray-900 dark:text-gray-50">{person.name}</span>
      <span className="block text-sm text-gray-500 dark:text-gray-400">{[person.email, describe(person), `asked ${when(person.createdAt)}`].filter(Boolean).join(" · ")}</span>
      {person.relation === "coach" && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          ⚠️ Says they&apos;re a coach. Only give the <strong>Coach</strong> role if you know them — it opens Coach Admin.
        </p>
      )}
      {kids.length > 0 && (
        <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-white/5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Their children in your squad:</p>
          {kids.map((c) => (
            <label key={c.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
              <span className="min-w-0 flex-1 font-semibold">
                {c.name}
                {c.team && <span className="font-normal text-gray-500 dark:text-gray-400"> · {c.team.name}</span>}
              </span>
              <select
                value={links[c.id] ?? "new"}
                onChange={(e) => setLinks({ ...links, [c.id]: e.target.value })}
                aria-label={`Squad player for ${c.name}`}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:bg-[#1c1c1e] dark:border-white/15"
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
      <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Approve as:</p>
      <RoleChips roles={roles} disabled={busy} onChange={setRoles} canAdmin={canAdmin} />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onDecide({ action: "approvePerson", userId: person.userId, roles, links })}
          disabled={busy || !roles.length}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
        >
          Approve
        </button>
        <button onClick={() => onDecide({ action: "declinePerson", userId: person.userId })} disabled={busy} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15">
          Decline
        </button>
      </div>
    </li>
  );
}

/** A change to a squad player: their team, their name and position, or taking them out of the squad. */
type PlayerChange = { id: string; team: string } | { edit: { id: string; name: string; position: "outfield" | "goalkeeper" } } | { remove: string };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

/** A player's photo (only coaches and their own guardians can load it), or their initials. */
function PlayerPhoto({ player, adminKey, size }: { player: SquadPlayer; adminKey: string; size: "row" | "big" }) {
  const box = size === "big" ? "h-32 w-32 rounded-[2rem] text-4xl" : "h-11 w-11 rounded-full text-sm";
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-green-100 font-bold text-green-800 dark:bg-green-400/15 dark:text-green-300 ${box}`}>
      {player.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a child's photo, private to the club's coaches and their family
        <img
          src={`/api/players/photo?id=${encodeURIComponent(player.id)}&key=${encodeURIComponent(adminKey)}&v=${player.photo}`}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(player.name)
      )}
    </span>
  );
}

/** A squad player: their photo, name and guardians — tap for their profile. */
function PlayerRow({ player, guardians, adminKey, onOpen }: { player: SquadPlayer; guardians: Person[]; adminKey: string; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="press flex w-full items-center gap-3 py-2.5 text-left">
        <PlayerPhoto player={player} adminKey={adminKey} size="row" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-gray-900 dark:text-gray-50">{player.name}</span>
          <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
            {guardians.length ? `Guardian: ${guardians.map((g) => g.name).join(", ")}` : "No parent or carer account yet"}
          </span>
        </span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </li>
  );
}

/** A player's profile, as a sheet: photo, name, team, and their guardians (tap one for their roles). */
function PlayerProfile({
  player,
  guardians,
  snap,
  adminKey,
  busy,
  onAct,
  onPlayer,
  onPhoto,
  onClose,
}: {
  player: SquadPlayer;
  guardians: Person[];
  snap: Snapshot;
  adminKey: string;
  busy: boolean;
  onAct: (body: Record<string, unknown>) => void;
  onPlayer: (change: PlayerChange) => void;
  onPhoto: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // their name and position, as being edited
  const [name, setName] = useState(player.name);
  const [position, setPosition] = useState(player.position ?? "outfield");
  const changed = name.trim() !== player.name || position !== (player.position ?? "outfield");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const teamName = snap.teams.find((t) => t.slug === player.team)?.name;

  // the page behind stays still while it's open
  useEffect(() => {
    const html = document.documentElement;
    const before = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = document.body.style.overflow = "hidden";
    return () => {
      [html.style.overflow, document.body.style.overflow] = before;
    };
  }, []);

  async function photo(file: File | null) {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const res = file
        ? await fetch(`/api/players/photo?key=${encodeURIComponent(adminKey)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: player.id, image: await squarePhoto(file) }),
          })
        : await fetch(`/api/players/photo?id=${encodeURIComponent(player.id)}&key=${encodeURIComponent(adminKey)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the photo");
      onPhoto();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Couldn't save the photo");
    } finally {
      setPhotoBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  // on the page's body, so it sits above the tab bar
  return createPortal(
    <div className="themed fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={player.name}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-[#f2f2f7] pb-[max(1rem,env(safe-area-inset-bottom))] text-gray-900 shadow-2xl dark:bg-[#1c1c1e] dark:text-gray-50 sm:rounded-3xl"
      >
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-[15px] font-bold text-green-700 dark:text-green-400">
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
          {/* photo, name and team */}
          <div className="flex flex-col items-center text-center">
            <PlayerPhoto player={player} adminKey={adminKey} size="big" />
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <button onClick={() => input.current?.click()} disabled={photoBusy} className="text-green-700 disabled:opacity-40 dark:text-green-400">
                {photoBusy ? "Saving…" : player.photo ? "Change Photo" : "Add Photo"}
              </button>
              {player.photo && (
                <button onClick={() => photo(null)} disabled={photoBusy} className="text-gray-500 disabled:opacity-40 dark:text-gray-400">
                  Remove
                </button>
              )}
              <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => photo(e.target.files?.[0] ?? null)} />
            </div>
            {photoError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{photoError}</p>}
            <h2 className="mt-3 text-2xl font-extrabold">{player.name}</h2>
            <p className="text-[15px] text-gray-500 dark:text-gray-400">{teamName ?? "No team yet"}</p>
          </div>

          <p className="mb-1.5 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Details</p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white dark:divide-white/10 dark:bg-black/40">
            <label className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 shrink-0 text-[15px] text-gray-500 dark:text-gray-400">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                aria-label={`${player.name}'s name`}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 shrink-0 text-[15px] text-gray-500 dark:text-gray-400">Position</span>
              <span className="flex flex-1 gap-1 rounded-full bg-gray-100 p-1 dark:bg-white/10">
                {(["outfield", "goalkeeper"] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPosition(pos)}
                    aria-pressed={position === pos}
                    className={`flex-1 rounded-full py-1.5 text-sm font-semibold ${
                      position === pos ? "bg-white text-gray-900 shadow-sm dark:bg-[#3a3a3c] dark:text-gray-50" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {pos === "outfield" ? "Outfield" : "Goalkeeper"}
                  </button>
                ))}
              </span>
            </div>
          </div>
          {changed && (
            <button
              onClick={() => onPlayer({ edit: { id: player.id, name: name.trim() || player.name, position } })}
              disabled={busy || !name.trim()}
              className="mt-2 w-full rounded-2xl bg-green-600 py-3 text-[16px] font-bold text-white hover:bg-green-700 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          )}
          {changed && name.trim() !== player.name && guardians.length > 0 && (
            <p className="mt-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">The new name is changed on their parent&apos;s account too.</p>
          )}

          <p className="mb-1.5 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Team</p>
          <div className="rounded-2xl bg-white px-4 py-3 dark:bg-black/40">
            <select
              value={teamName ? player.team : ""}
              onChange={(e) => onPlayer({ id: player.id, team: e.target.value })}
              disabled={busy}
              aria-label={`${player.name}'s team`}
              className="w-full bg-transparent text-[16px] font-semibold focus:outline-none"
            >
              <option value="">No team yet</option>
              {snap.teams.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <p className="mb-1.5 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Parents & Carers
          </p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white dark:divide-white/10 dark:bg-black/40">
            {guardians.length === 0 && <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No parent or carer account yet.</p>}
            {guardians.map((g) => {
              const others = childrenOf(g).filter((c) => c.playerId !== player.id);
              const extra = [
                g.relation && g.relation !== "parent" ? RELATIONS[g.relation] : "",
                g.roles.includes("coach") && hasOwnTeam(g) && g.team ? `Coaches ${g.team.name}` : g.roles.includes("admin") ? "Club admin" : "",
                others.length ? `Also guardian of ${others.map((c) => c.name).join(", ")}` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={g.userId} className="px-4">
                  <button onClick={() => setOpen(open === g.userId ? null : g.userId)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-200 text-xs font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                      {initialsOf(g.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{g.name}</span>
                      <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{[g.email, extra].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">{open === g.userId ? "Close" : "Manage"}</span>
                  </button>
                  {open === g.userId && (
                    <ul className="pb-2">
                      <MemberRow person={g} guardian note="Their roles, team and children" teams={snap.teams} canAdmin={snap.canAdmin} busy={busy} onAct={onAct} />
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {snap.canAdmin && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete ${player.name} from the squad? Their season stats go too${guardians.length ? `, and they come off ${guardians.map((g) => g.name).join(" and ")}'s list of children` : ""}. This can't be undone (except from a backup).`,
                  )
                ) {
                  onPlayer({ remove: player.id });
                  onClose();
                }
              }}
              disabled={busy}
              className="mt-5 w-full rounded-2xl bg-white py-3 text-[16px] font-semibold text-red-600 disabled:opacity-40 dark:bg-black/40 dark:text-red-400"
            >
              Delete From Squad
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** An approved member: their details and roles, and fixing their team (or their children's). */
function MemberRow({
  person,
  inTeam,
  note,
  guardian = false,
  teams,
  canAdmin,
  busy,
  onAct,
}: {
  person: Person;
  inTeam?: string;
  /** what to say under their name, in place of the usual description */
  note?: string;
  /** shown under a player, as one of their guardians */
  guardian?: boolean;
  teams: TeamOption[];
  canAdmin: boolean;
  busy: boolean;
  onAct: (body: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isParent = person.relation === "parent" || childrenOf(person).length > 0;
  // a team of their own: anyone who isn't only a parent (a parent who coaches has one as well as their children's)
  const ownTeam = !isParent || person.roles.some((r) => r !== "parent");
  const [kids, setKids] = useState<ChildDraft[]>(() => {
    const now = toDrafts(childrenOf(person));
    return now.length ? now : [{ name: "", team: "" }];
  });
  const [team, setTeam] = useState(person.team?.slug ?? "");

  return (
    <li className={guardian ? "py-2" : "py-3"}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        {/* the name gets the room; Edit and Remove from Club go underneath when it's tight */}
        <span className="min-w-[13rem] flex-1">
          <span className={`block font-bold text-gray-900 dark:text-gray-50 ${guardian ? "text-sm" : ""}`}>{person.name}</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">{note ?? [person.email, describe(person, inTeam)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex gap-3">
          <button onClick={() => setEditing(!editing)} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40 dark:text-green-400">
            {editing ? "Close" : "Edit"}
          </button>
          {(canAdmin || !person.roles.some((r) => ADMIN_ROLES.includes(r))) && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Remove ${person.name} from the club? This isn't taking a role away (tap the role for that) — they'll lose access to the hub completely until they ask to join again.`,
                  )
                )
                  onAct({ action: "removePerson", userId: person.userId });
              }}
              disabled={busy}
              className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400"
            >
              Remove from Club
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
        <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-white/5">
          {/* their own team (the one they coach, or play for) — a parent who also coaches has both */}
          {ownTeam && (
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
              {isParent ? "Their own team (the one they coach)" : "Team"}
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15">
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
          {isParent && (
            <div className={ownTeam ? "mt-4" : ""}>
              <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Their children and teams</p>
              <ChildrenEditor value={kids} teams={teams} onChange={setKids} />
            </div>
          )}
          <button
            onClick={() => {
              onAct({
                action: "editPerson",
                userId: person.userId,
                ...(ownTeam ? { team } : {}),
                ...(isParent ? { children: kids.filter((k) => k.name.trim()) } : {}),
              });
              setEditing(false);
            }}
            disabled={busy}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-40 dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900"
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
  const field = "rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";
  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:bg-[#1c1c1e] dark:border-white/10">
      <h2 className="font-extrabold text-gray-900 dark:text-gray-50">✉️ Invite by Email</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:border-white/10 dark:divide-white/10">
          {snap.invites.map((i) => (
            <li key={i.email} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 dark:text-gray-50">{i.name || i.email}</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">
                  {[i.name ? i.email : "", i.roles.map((r) => ROLES[r]).join(", "), i.team?.name, `invited ${when(i.createdAt)}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              {(snap.canAdmin || !i.roles.some((r) => ADMIN_ROLES.includes(r))) && (
                <button onClick={() => onAct({ action: "cancelInvite", email: i.email })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400">
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
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:bg-[#1c1c1e] dark:border-white/10">
      <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🔑 Shared Coach Password</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
            snap.passwordOff ? "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15" : "bg-gray-900 text-white hover:bg-black dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900"
          }`}
        >
          {snap.passwordOff ? "Switch the Password Back On" : "Switch the Password Off"}
        </button>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          To change this, sign in with your own club admin account (Coach Admin → Sign In With Your Email).
        </p>
      )}
    </section>
  );
}
