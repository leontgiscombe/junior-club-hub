"use client";

// Coach Admin → Settings: how people get in. "Joining the Club" (the hub's
// link, the club code and join link, who's allowed in, and inviting coaches by
// email) and "Sign-In & Passwords" (the shared coach password, and the phones
// approved before accounts). Both read and change the club's access through
// the Members API, as Members did when these lived there.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { ROLES, type Member, type Role } from "@/lib/access";
import { ADMIN_ROLES, RoleChips } from "./MembersAdmin";
import { RowsSkeleton } from "./Skeleton";

type TeamOption = { slug: string; name: string };
export type AccessSnap = {
  private: boolean;
  code: string;
  joinUrl: string;
  platformJoin: string | null;
  teams: TeamOption[];
  members: Member[];
  invites: { email: string; name?: string; roles: Role[]; team?: TeamOption; invitedBy: string; createdAt: string }[];
  canAdmin: boolean;
  passwordOff: boolean;
  sharedPassword: boolean;
  accountAdmin: boolean;
};

/** The club's access settings, and a way to change them. */
export function useClubAccess(adminKey: string) {
  const [snap, setSnap] = useState<AccessSnap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!adminKey) return;
    const res = await fetch(`/api/members?key=${encodeURIComponent(adminKey)}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setSnap(await res.json());
  }, [adminKey]);
  // once the coach's key is known
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/members?key=${encodeURIComponent(adminKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "That didn't work");
        setSnap(data);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't work");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [adminKey],
  );
  return { snap, busy, error, act };
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const card = "mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]";
const heading = "font-extrabold text-gray-900 dark:text-gray-50";
const note = "mt-1 text-sm text-gray-500 dark:text-gray-400";
const plainBtn =
  "cursor-pointer rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };
  return { copied, copy };
}

function Problem({ error }: { error: string | null }) {
  return error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p> : null;
}

/** Settings → Joining the Club. */
export function JoiningScreen({ adminKey, clubName }: { adminKey: string; clubName: string }) {
  const { snap, busy, error, act } = useClubAccess(adminKey);
  const { copied, copy } = useCopy();
  const [qr, setQr] = useState("");
  const [canShare, setCanShare] = useState(false);
  // a QR code of the join link, for a poster or a phone held up at training
  useEffect(() => {
    if (!snap) return;
    let live = true;
    QRCode.toString(snap.joinUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((svg) => live && setQr(svg))
      .catch(() => {});
    const t = setTimeout(() => setCanShare("share" in navigator), 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [snap]);

  if (!snap) return <div className={card}><RowsSkeleton rows={2} /></div>;
  return (
    <>
      <Problem error={error} />
      <section className={card}>
        <h2 className={heading}>Your Club Code</h2>
        <p className={note}>
          Send parents, players and coaches the join link, or give them the code. They sign in with their email and ask to
          join; you approve them in Members.
          {snap.platformJoin && (
            <>
              {" "}They can also type the code at <strong>{snap.platformJoin.replace(/^https?:\/\//, "").replace(/\/$/, "")}</strong>.
            </>
          )}
        </p>
        <p className="mt-4 select-all rounded-2xl bg-gray-50 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.2em] text-gray-900 dark:bg-white/5 dark:text-gray-50">
          {snap.code}
        </p>
        {qr && (
          // white behind it in dark mode too, so cameras can read it
          <div
            className="mx-auto mt-4 w-44 rounded-2xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label="QR code of the join link"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {canShare && (
            <button
              onClick={() => navigator.share({ title: `Join ${clubName}`, text: `Join ${clubName} on the club's app — the club code is ${snap.code}`, url: snap.joinUrl }).catch(() => {})}
              className="cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700"
            >
              Share Join Link
            </button>
          )}
          <button onClick={() => copy(snap.joinUrl, "link")} className={plainBtn}>
            {copied === "link" ? "Copied ✓" : "Copy Join Link"}
          </button>
          <button onClick={() => copy(snap.code, "code")} className={plainBtn}>
            {copied === "code" ? "Copied ✓" : "Copy Code"}
          </button>
          {snap.canAdmin && (
            <button
              onClick={() => {
                if (confirm("Make a new code? The old code and join link stop working; members already approved stay approved.")) act({ action: "newCode" });
              }}
              disabled={busy}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400"
            >
              New Code
            </button>
          )}
        </div>
      </section>

      <section className={card}>
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span>
            <span className={`block ${heading}`}>Only Approved Members</span>
            <span className={`block ${note}`}>
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
              if (on && !confirm("Turn on? Everyone apart from coaches will need to ask to join with the club code, and you'll approve them in Members.")) return;
              act({ action: "private", value: on });
            }}
            className="mt-1 h-6 w-6 shrink-0 accent-green-600"
          />
        </label>
        {!snap.canAdmin && <p className="mt-2 text-xs text-gray-400">Only a club admin can change this.</p>}
      </section>

      <InviteCard snap={snap} busy={busy} act={act} />
    </>
  );
}

function InviteCard({ snap, busy, act }: { snap: AccessSnap; busy: boolean; act: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["coach"]);
  const [team, setTeam] = useState("");
  const shownRoles = snap.canAdmin ? roles : roles.filter((r) => !ADMIN_ROLES.includes(r));
  const field =
    "rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15 dark:bg-transparent";
  return (
    <section className={card}>
      <h2 className={heading}>Invite by Email</h2>
      <p className={note}>
        For your coaches and helpers: they get an email, sign in with that address, and they&apos;re straight in with the
        roles you choose. No code or approval needed.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className={field} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" maxLength={60} className={field} />
        {snap.teams.length > 0 && (
          <select value={team} onChange={(e) => setTeam(e.target.value)} className={field}>
            <option value="">Team (optional)</option>
            {snap.teams.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <RoleChips roles={shownRoles} disabled={busy} onChange={setRoles} canAdmin={snap.canAdmin} />
      <button
        onClick={async () => {
          if (await act({ action: "invite", email, name, roles: shownRoles, team })) {
            setEmail("");
            setName("");
          }
        }}
        disabled={busy || !email.includes("@") || !shownRoles.length}
        className="mt-3 cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
      >
        Send Invite
      </button>
      {snap.invites.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-white/10 dark:border-white/10">
          {snap.invites.map((i) => (
            <li key={i.email} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 dark:text-gray-50">{i.name || i.email}</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">
                  {[i.name ? i.email : "", i.roles.map((r) => ROLES[r]).join(", "), i.team?.name, `invited ${when(i.createdAt)}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              {(snap.canAdmin || !i.roles.some((r) => ADMIN_ROLES.includes(r))) && (
                <button
                  onClick={() => act({ action: "cancelInvite", email: i.email })}
                  disabled={busy}
                  className="text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400"
                >
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

/**
 * Settings → Sign-In & Passwords: the shared coach password, then whatever
 * the page adds (the club admin's own sign-in, the teams' finance passwords),
 * then any phones approved before accounts.
 */
export function SignInScreen({ adminKey, children }: { adminKey: string; children?: ReactNode }) {
  const { snap, busy, error, act } = useClubAccess(adminKey);
  const phones = snap ? snap.members.filter((m) => m.status !== "declined") : [];
  return (
    <>
      <Problem error={error} />
      {snap?.canAdmin && snap.sharedPassword && (
        <section className={card}>
          <h2 className={heading}>Shared Coach Password</h2>
          <p className={note}>
            {snap.passwordOff
              ? "Off: everyone signs in with their own account. Nobody can get in with a shared password."
              : "On: anyone with the club's coach password can still use Coach Admin. Once your coaches have their own accounts, switch it off. Then taking someone out of Members takes away their access straight away."}
          </p>
          {snap.accountAdmin ? (
            <button
              onClick={() => {
                if (snap.passwordOff || confirm("Switch the shared coach password off? Only people with their own account and the Club admin or Coach role will be able to use Coach Admin.")) {
                  act({ action: "password", off: !snap.passwordOff });
                }
              }}
              disabled={busy}
              className={`mt-3 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${
                snap.passwordOff ? plainBtn : "bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
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
      )}
      {children}
      {phones.length > 0 && (
        <section className={card}>
          <h2 className={heading}>Phones Approved Before Accounts</h2>
          <p className={note}>These still work. Ask each person to sign in and join with an account, then remove their phone here.</p>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
            {phones.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block font-bold text-gray-900 dark:text-gray-50">
                    {m.name}
                    {m.role === "coach" && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-white/10 dark:text-gray-300">Coach</span>}
                  </span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">{m.status === "pending" ? "waiting" : `approved ${when(m.decidedAt ?? m.createdAt)}`}</span>
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
    </>
  );
}
