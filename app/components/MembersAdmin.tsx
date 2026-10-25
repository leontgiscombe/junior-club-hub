"use client";

// Coach Admin → Members: the club's people — approving (or not) those who ask to
// join, and each team's coaches, players and their parents. How people get in
// (the club code, invites, passwords) is in Settings (ClubAccess.tsx).
import Link from "next/link";
import { likelyPlayer } from "@/lib/nameMatch";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollLock } from "./useScrollLock";
import { createPortal } from "react-dom";
import { squarePhoto } from "../account/ProfilePhoto";
import { RELATIONS, ROLES, childrenOf, hasOwnTeam, teamsOf, type Member, type Person, type Role } from "@/lib/access";
import ChildrenEditor, { toDrafts, type ChildDraft } from "./ChildrenEditor";
import { PlayerCareForm } from "./PlayerCare";
import PlayerDevices from "./PlayerDevices";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { ToolTabs, TopBar, useScreens, GateScreen } from "./SettingsUI";
import { StepBar, StepButtons } from "./Steps";
import { haptic } from "@/lib/haptics";
import { ask } from "@/lib/dialog";
import { GateIcon } from "./Icons";
import TeamPicker from "./TeamPicker";

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

// a team's (or the club's) section of members: a rounded card that folds, with its count and an arrow
const FOLD = "group mt-4 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
const FOLD_HEAD = "flex cursor-pointer select-none list-none items-center gap-2 px-4 py-3.5 font-bold text-gray-900 dark:text-gray-50 [&::-webkit-details-marker]:hidden";

/** The roles only a club admin can give or take away. */
export const ADMIN_ROLES: Role[] = ["admin", "coach", "treasurer"];
type SquadPlayer = {
  id: string;
  name: string;
  team: string;
  position?: "outfield" | "goalkeeper";
  /** their photo's version, if they have one */
  photo?: string;
  /** a parent took them off their account (they may have left the club) */
  removed?: { by: string; at: string };
};

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
  const { screen, switchTo } = useScreens("/admin/members");
  const view = screen === "waiting" || screen === "access" ? screen : "members";
  const [teamFilter, setTeamFilter] = useState("all");
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
      haptic();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (!authed || !snap) {
    if (checking) return <ToolSkeleton />;
    return (
      <GateScreen title="Members">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm dark:bg-[#1c1c1e]">
          <div className="mb-6 text-center">
            <GateIcon />
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
        </div>
      </GateScreen>
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
  // children approved parents have added since, for a coach to approve
  const waitingKids: { person: Person; child: ReturnType<typeof childrenOf>[number] }[] = [];
  for (const p of approved) {
    for (const c of childrenOf(p)) {
      if (c.playerId) guardiansOf.set(c.playerId, [...(guardiansOf.get(c.playerId) ?? []), p]);
      else if (c.pending) waitingKids.push({ person: p, child: c });
      else unmatched.push({ person: p, child: c });
    }
  }
  const waitingCount = pending.length + waitingKids.length;
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
      haptic();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
      setBusy(false);
    }
  }

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50 pb-16">
      <TopBar title="Members" href={`/admin${keyQuery(key)}`} />

      <div className="mx-auto max-w-2xl px-4 py-4">
        <ToolTabs label="Member views" tabs={[{ id: "members", label: "Members" }, { id: "waiting", label: "Approvals", count: waitingCount }, { id: "access", label: "Access" }]} value={view} onChange={(next) => { setProfile(null); switchTo(next); }} panelId="members-panel" />
        <div id="members-panel" role="tabpanel" aria-label={view}>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}

        {/* Waiting */}
        <div hidden={view !== "waiting"}>
        <Fold id="waiting" title="Waiting for Approval" summary={waitingCount ? String(waitingCount) : "None"} alert={waitingCount > 0} forceOpen={view === "waiting"}>
          <div className="flex items-center justify-end">
            <button onClick={() => load(key)} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40 dark:text-green-400">
              Refresh
            </button>
          </div>
          {waitingCount === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No one is waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {pending.map((p) => (
                <PendingPerson key={p.userId} person={p} players={snap.players} canAdmin={snap.canAdmin} busy={busy} onDecide={act} />
              ))}
              {waitingKids.map(({ person, child }) => (
                <PendingChild key={`${person.userId}:${child.id}`} person={person} child={child} teams={snap.teams} players={snap.players} busy={busy} onDecide={act} />
              ))}
            </ul>
          )}
        </Fold>
        </div>

        {/* Approved: like Spond — each team's coaches and staff, then its players with their guardians */}
        <section hidden={view !== "members"}>
          <TeamPicker className="block" value={teamFilter} onChange={(value) => setTeamFilter(value)} options={[{ value: "all", label: "All teams" }, ...snap.teams.map((team) => ({ value: team.slug, label: team.name }))]} />
          <label className="relative mt-3 block">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players, parents or coaches"
              aria-label="Search members"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50"
            />
          </label>
          {approved.length === 0 && snap.players.length === 0 && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No members yet.</p>}

          {/* children not yet in the squad */}
          {unmatched.length > 0 && !q && teamFilter === "all" && (
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
          {clubWide.length > 0 && teamFilter === "all" && (
            <details open className={FOLD}>
              <summary className={FOLD_HEAD}>
                <span className="min-w-0 flex-1 truncate">Club-Wide Staff</span>
                <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">{clubWide.length}</span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 transition-transform group-open:rotate-90 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </summary>
              <ul className="divide-y divide-gray-100 border-t border-gray-100 px-4 dark:divide-white/10 dark:border-white/10">
                {clubWide.map((p) => (
                  <MemberRow key={p.userId} person={p} note={staffLine(p)} teams={snap.teams} canAdmin={snap.canAdmin} busy={busy} onAct={act} />
                ))}
              </ul>
            </details>
          )}

          {teamGroups.filter((group) => teamFilter === "all" || group.slug === teamFilter).map((g) => (
            <details key={g.slug || "none"} open={!!q || teamFilter !== "all"} className={FOLD}>
              <summary className={FOLD_HEAD}>
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {g.squad.length} player{g.squad.length === 1 ? "" : "s"}
                  {g.staff.length ? ` · ${g.staff.length} staff` : ""}
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 transition-transform group-open:rotate-90 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </summary>
              <div className="border-t border-gray-100 px-4 pb-2 dark:border-white/10">
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
          {carers.length > 0 && teamFilter === "all" && (
            <details open={!!q} className={FOLD}>
              <summary className={FOLD_HEAD}>
                <span className="min-w-0 flex-1 truncate">Parents &amp; Carers</span>
                <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">{carers.length}</span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 transition-transform group-open:rotate-90 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </summary>
              <ul className="divide-y divide-gray-100 border-t border-gray-100 px-4 dark:divide-white/10 dark:border-white/10">
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

        <div hidden={view !== "access"}>
        {/* how people get in: the club code, invites, who's allowed in, passwords */}
        <Link
          href={`/admin/settings${keyQuery(key)}#joining`}
          className="press mt-4 flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm dark:bg-[#1c1c1e]"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-gray-900 dark:text-gray-50">Club Code &amp; Invites</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              Code <span className="font-mono font-bold">{snap.code}</span> · in Settings → Joining the Club
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>

        {declined.length > 0 && (
          <Fold id="declined" title="Declined" summary={String(declined.length)}>
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {declined.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-900 dark:text-gray-50">{p.name}</span>
                    <span className="block text-sm text-gray-500 dark:text-gray-400">{[p.email, p.phone, describe(p)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button onClick={() => act({ action: "removePerson", userId: p.userId })} disabled={busy} className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </Fold>
        )}
        </div>
        </div>
      </div>
    </main>
  );
}

/**
 * A section that folds away: its heading (with a short summary, e.g. the code
 * or "On") is always there; tap it to open or close. Each one remembers on
 * this phone whether it was left open. `forceOpen` opens it regardless (people
 * waiting for approval).
 */
function Fold({
  id,
  title,
  summary,
  alert = false,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  /** the summary in red (something needs doing) */
  alert?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const storeKey = `hub_members_fold_${id}`;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this phone's choice is only known in the browser
      if (saved) setOpen(saved === "1");
    } catch {}
  }, [storeKey]);
  const shown = open || forceOpen;
  const toggle = () => {
    const next = !shown;
    setOpen(next);
    try {
      localStorage.setItem(storeKey, next ? "1" : "0");
    } catch {}
  };
  return (
    <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]">
      <button onClick={toggle} aria-expanded={shown} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="min-w-0 flex-1 truncate font-extrabold text-gray-900 dark:text-gray-50">{title}</span>
        {summary && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${
              alert ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
            }`}
          >
            {summary}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${shown ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {shown && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

const ALL_ROLES = Object.keys(ROLES) as Role[];

/** A person's roles as chips to tap on and off. */
export function RoleChips({
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
  // checked a step at a time once opened: who they are, their children, then their roles
  const [step, setStep] = useState<number | null>(null);
  const steps = [
    { id: "who", label: "Who" },
    ...(kids.length > 0 ? [{ id: "children", label: "Children" }] : []),
    { id: "roles", label: "Roles" },
  ];
  const at = steps[step ?? 0].id;
  const decline = (
    <button onClick={() => onDecide({ action: "declinePerson", userId: person.userId })} disabled={busy} className="mt-3 w-full text-center text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-40 dark:text-red-400">
      Decline {person.name}
    </button>
  );
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-gray-900 dark:text-gray-50">{person.name}</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">{[describe(person), `asked ${when(person.createdAt)}`].filter(Boolean).join(" · ")}</span>
        </span>
        {step === null ? (
          <button onClick={() => setStep(0)} className="shrink-0 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">
            Review
          </button>
        ) : (
          <button onClick={() => setStep(null)} className="shrink-0 text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400">
            Close
          </button>
        )}
      </div>
      {step !== null && (
        <div className="mt-3">
          <StepBar steps={steps} step={step} onChange={setStep} />
          {at === "who" && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Check you know them</p>
              <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5">
                <dt className="text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="font-semibold text-gray-900 dark:text-gray-50">{person.name}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                <dd className="break-all text-gray-900 dark:text-gray-50">{person.email || "—"}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
                <dd className="text-gray-900 dark:text-gray-50">{person.phone || "—"}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Says</dt>
                <dd className="text-gray-900 dark:text-gray-50">{describe(person) || "—"}</dd>
              </dl>
              {person.relation === "coach" && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                  Says they&apos;re a coach. Only give the <strong>Coach</strong> role if you know them — it opens Coach Admin.
                </p>
              )}
            </div>
          )}
          {at === "children" && (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Their children: already in your squad? Pick them, so they aren&apos;t added twice.
              </p>
              {kids.map((c) => (
                // the child's name on its own line, the choice full width under it
                <label key={c.id} className="mt-2 block text-sm text-gray-800 dark:text-gray-100">
                  <span className="block font-semibold">
                    {c.name}
                    {c.team && <span className="font-normal text-gray-500 dark:text-gray-400"> · {c.team.name}</span>}
                  </span>
                  <select
                    value={links[c.id] ?? "new"}
                    onChange={(e) => setLinks({ ...links, [c.id]: e.target.value })}
                    aria-label={`Squad player for ${c.name}`}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:bg-[#1c1c1e] dark:border-white/15"
                  >
                    <option value="new">New to the squad — add them</option>
                    {players
                      .filter((pl) => !c.team || pl.team === c.team.slug)
                      .map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          Already in the squad: {pl.name}
                        </option>
                      ))}
                  </select>
                  {links[c.id] && links[c.id] !== "new" && (
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">The closest name in the squad is picked — check it&apos;s the same child.</span>
                  )}
                </label>
              ))}
            </div>
          )}
          {at === "roles" && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Approve {person.name} as:</p>
              <RoleChips roles={roles} disabled={busy} onChange={setRoles} canAdmin={canAdmin} />
            </div>
          )}
          <StepButtons
            step={step}
            count={steps.length}
            nextLabel={`Next: ${steps[step + 1]?.label}`}
            onChange={setStep}
            finish={{ label: "Approve", onClick: () => onDecide({ action: "approvePerson", userId: person.userId, roles, links }), disabled: busy || !roles.length }}
          />
          {decline}
        </div>
      )}
    </li>
  );
}

/** A child an approved parent has added: into the squad (new, or an existing player), or declined. */
function PendingChild({
  person,
  child,
  teams,
  players,
  busy,
  onDecide,
}: {
  person: Person;
  child: ReturnType<typeof childrenOf>[number];
  teams: { slug: string; name: string }[];
  players: SquadPlayer[];
  busy: boolean;
  onDecide: (body: Record<string, unknown>) => void;
}) {
  const [team, setTeam] = useState(child.requestedTeam?.slug ?? "");
  const [link, setLink] = useState(() => likelyPlayer({ name: child.name, ...(team ? { team: { slug: team } } : {}) }, players));
  const field = "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:bg-[#1c1c1e] dark:border-white/15";
  return (
    <li className="py-3">
      <span className="block font-bold text-gray-900 dark:text-gray-50">{child.name}</span>
      <span className="block text-sm text-gray-500 dark:text-gray-400">
        {[`New child of ${person.name}`, child.requestedTeam ? `asks for ${child.requestedTeam.name}` : ""].filter(Boolean).join(" · ")}
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-label={`Squad player for ${child.name}`}
          className={field}
        >
          <option value="new">New to the squad — add them</option>
          {players
            .filter((pl) => !team || pl.team === team)
            .map((pl) => (
              <option key={pl.id} value={pl.id}>
                Already in the squad: {pl.name}
              </option>
            ))}
        </select>
        {link === "new" && (
          <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label={`Team for ${child.name}`} className={field}>
            <option value="">No team yet</option>
            {teams.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onDecide({ action: "approveChild", userId: person.userId, childId: child.id, link, team })}
          disabled={busy}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
        >
          Add to Squad
        </button>
        <button
          onClick={async () => await ask(`Decline ${child.name}? They'll come off ${person.name}'s list of children.`) && onDecide({ action: "declineChild", userId: person.userId, childId: child.id })}
          disabled={busy}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15"
        >
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
          {player.removed ? (
            <span className="block truncate text-sm font-semibold text-amber-700 dark:text-amber-300">Removed from {player.removed.by}&apos;s account</span>
          ) : (
            <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
              {guardians.length ? `Guardian: ${guardians.map((g) => g.name).join(", ")}` : "No parent or carer account yet"}
            </span>
          )}
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
  useScrollLock();

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

          {player.removed && (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              <p>
                <strong>{player.removed.by}</strong> removed {player.name.split(/\s+/)[0]} from their account on{" "}
                {new Date(player.removed.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. If they&apos;ve left the club,
                delete them from the squad below — that stops their subs too.
              </p>
              <button onClick={() => onAct({ action: "dismissRemoval", id: player.id })} disabled={busy} className="mt-2 font-bold text-amber-800 disabled:opacity-40 dark:text-amber-200">
                They&apos;re Staying — Dismiss
              </button>
            </div>
          )}

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
            Medical & Emergency
          </p>
          <PlayerCareForm playerId={player.id} first={player.name.trim().split(/\s+/)[0] || "Their"} adminKey={adminKey} />

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
                      <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{[g.email, g.phone, extra].filter(Boolean).join(" · ")}</span>
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

          <p className="mb-1.5 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Player&apos;s Own Devices
          </p>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-black/40">
            <span className="text-sm text-gray-500 dark:text-gray-400">Their own phone or tablet, for the Training Hub only.</span>
            <PlayerDevices playerId={player.id} name={player.name} adminKey={adminKey} className="shrink-0 text-sm font-semibold text-green-700 dark:text-green-400" />
          </div>

          {snap.canAdmin && (
            <button
              onClick={async () => {
                if (
                  await ask(
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
          <span className="block text-sm text-gray-500 dark:text-gray-400">{note ?? [person.email, person.phone, describe(person, inTeam)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex gap-3">
          <button onClick={() => setEditing(!editing)} disabled={busy} className="text-sm font-semibold text-green-700 hover:underline disabled:opacity-40 dark:text-green-400">
            {editing ? "Close" : "Edit"}
          </button>
          {(canAdmin || !person.roles.some((r) => ADMIN_ROLES.includes(r))) && (
            <button
              onClick={async () => {
                if (
                  await ask(
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
          {/* their own team (the one they coach, look after the money for, or play for) — a parent who also coaches has both */}
          {ownTeam && (
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
              {person.roles.includes("coach")
                ? "The team they coach"
                : person.roles.includes("treasurer")
                  ? "The team they're treasurer for"
                  : person.roles.includes("player")
                    ? "The team they play for"
                    : isParent
                      ? "Their own team"
                      : "Team"}
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15">
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
              {person.roles.includes("treasurer") && !person.roles.includes("admin") && (
                <span className="mt-1 block font-normal text-gray-400">
                  Their account opens just this team in Finances (No team: every team). Any team still opens with its own password.
                </span>
              )}
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
