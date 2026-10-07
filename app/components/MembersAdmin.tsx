"use client";

// Coach Admin → Members: the club's join code and link, whether only approved
// members can open the hub, and approving (or not) the people who ask to join.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RELATIONS, ROLES, SESSION_KEY, type Member, type Person, type Role } from "@/lib/access";

type Snapshot = {
  private: boolean;
  code: string;
  joinUrl: string;
  platformJoin: string | null;
  people: Person[];
  members: Member[];
};

/** "Parent or carer of Sam B · U9s Hawks · new this season" */
function describe(m: Pick<Member, "relation" | "child" | "team" | "note">): string {
  const who = m.relation ? `${RELATIONS[m.relation]}${m.child ? ` of ${m.child}` : ""}` : "";
  return [who, m.team?.name, m.note].filter(Boolean).join(" · ");
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
  const [teamFilter, setTeamFilter] = useState("");

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

  const everyone = [...snap.people, ...snap.members];
  const teams = [...new Map(everyone.filter((m) => m.team).map((m) => [m.team!.slug, m.team!.name])).entries()];
  const onTeam = <T extends { team?: { slug: string } }>(list: T[]) => (teamFilter ? list.filter((m) => m.team?.slug === teamFilter) : list);
  const people = onTeam(snap.people);
  const pending = people.filter((p) => p.status === "pending");
  const approved = people.filter((p) => p.status === "approved");
  const declined = people.filter((p) => p.status === "declined");
  // phones approved before accounts (and any still waiting from then)
  const phones = onTeam(snap.members).filter((m) => m.status !== "declined");
  const card = "mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm";

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-green-700 px-4 py-6 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href={`/admin?key=${encodeURIComponent(key)}`} className="text-sm font-medium text-green-200 hover:text-white">
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
            <button
              onClick={() => {
                if (confirm("Make a new code? The old code and join link stop working; members already approved stay approved.")) act({ action: "newCode" });
              }}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40"
            >
              New Code
            </button>
          </div>
        </section>

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
              disabled={busy}
              onChange={(e) => {
                const on = e.target.checked;
                if (on && !confirm("Turn on? Everyone apart from coaches will need to ask to join with the club code, and you'll approve them here.")) return;
                act({ action: "private", value: on });
              }}
              className="mt-1 h-6 w-6 shrink-0 accent-green-600"
            />
          </label>
        </section>

        {teams.length > 1 && (
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            Show
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <option value="">Every team</option>
              {teams.map(([slug, name]) => (
                <option key={slug} value={slug}>{name}</option>
              ))}
            </select>
          </label>
        )}

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
                <PendingPerson key={p.userId} person={p} busy={busy} onDecide={act} />
              ))}
            </ul>
          )}
        </section>

        {/* Approved */}
        <section className={card}>
          <h2 className="font-extrabold text-gray-900">✅ Members ({approved.length})</h2>
          <p className="mt-1 text-sm text-gray-500">
            Tap a role to give or take it away. Club admins and coaches can use Coach Admin.
          </p>
          {approved.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No members yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {approved.map((p) => (
                <li key={p.userId} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-bold text-gray-900">{p.name}</span>
                      <span className="block truncate text-sm text-gray-500">{[p.email, describe(p)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${p.name}? They won't be able to open the hub until they ask again.`)) act({ action: "removePerson", userId: p.userId });
                      }}
                      disabled={busy}
                      className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                  <RoleChips
                    roles={p.roles}
                    disabled={busy}
                    onChange={(roles) => roles.length && act({ action: "personRoles", userId: p.userId, roles })}
                  />
                </li>
              ))}
            </ul>
          )}
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
function RoleChips({ roles, disabled, onChange }: { roles: Role[]; disabled: boolean; onChange: (roles: Role[]) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {ALL_ROLES.map((r) => {
        const on = roles.includes(r);
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
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
function PendingPerson({ person, busy, onDecide }: { person: Person; busy: boolean; onDecide: (body: Record<string, unknown>) => void }) {
  const first: Role = person.relation === "player" ? "player" : person.relation === "coach" ? "coach" : "parent";
  const [roles, setRoles] = useState<Role[]>([first]);
  return (
    <li className="py-3">
      <span className="block font-bold text-gray-900">{person.name}</span>
      <span className="block text-sm text-gray-500">{[person.email, describe(person), `asked ${when(person.createdAt)}`].filter(Boolean).join(" · ")}</span>
      <p className="mt-2 text-xs font-semibold text-gray-500">Approve as:</p>
      <RoleChips roles={roles} disabled={busy} onChange={setRoles} />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onDecide({ action: "approvePerson", userId: person.userId, roles })}
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
