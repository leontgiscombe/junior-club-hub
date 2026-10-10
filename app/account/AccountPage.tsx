"use client";

// Your account, laid out like a phone's settings: your photo and name at the
// top, then grouped rows that each open their own screen (#details, #clubs,
// #here, #security, #alerts, #delete) — your name, your clubs and roles, your
// children or team, passkeys, a club admin's or coach's join request alerts,
// signing out, and deleting the account (which also takes you out of every club).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ROLES, type Child, type MemberStatus, type Relation, type Role } from "@/lib/access";
import ChildrenEditor, { toDrafts, type ChildDraft } from "../components/ChildrenEditor";
import { AlertsSettings, useJoinRequests } from "../components/JoinAlerts";
import ProfilePhoto from "./ProfilePhoto";
import { addPasskey, cancelled, supportsPasskeys } from "../components/passkey";

type PasskeyRow = { id: string; label: string; prf: boolean | null; createdAt: string; lastUsedAt: string | null };

type Here = {
  club: string;
  person: { status: MemberStatus; relation: Relation | null; team: { slug: string } | null; children: Child[] } | null;
  teams: { slug: string; name: string }[];
};

type Account = {
  user: { email: string; name: string };
  clubs: { id: string; name: string; url: string; roles: Role[]; status: MemberStatus }[];
};

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  // this club (on a club's own address): your children, or your team
  const [here, setHere] = useState<Here | null>(null);
  const [kids, setKids] = useState<ChildDraft[]>([]);
  const [myTeam, setMyTeam] = useState("");
  const [hereMessage, setHereMessage] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
  const [canPasskey, setCanPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then(async (res) => {
      if (res.status === 401) {
        window.location.href = "/signin?next=/account";
        return;
      }
      const data = (await res.json()) as Account;
      setAccount(data);
      setName(data.user.name);
      setCanPasskey(supportsPasskeys());
      fetch("/api/auth/passkey", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { passkeys: [] }))
        .then((d) => setPasskeys(d.passkeys));
      const h = await fetch("/api/me/club", { cache: "no-store" });
      if (!h.ok) return;
      const hd = (await h.json()) as Here;
      if (!hd.person) return;
      setHere(hd);
      setKids(hd.person.children.length ? toDrafts(hd.person.children) : [{ name: "", team: "" }]);
      setMyTeam(hd.person.team?.slug ?? "");
    });
  }, []);

  async function saveHere() {
    if (!here?.person) return;
    setBusy(true);
    setHereMessage(null);
    const isParent = here.person.relation === "parent" || here.person.children.length > 0;
    const res = await fetch("/api/me/club", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isParent ? { children: kids.filter((k) => k.name.trim()) } : { team: myTeam }),
    });
    setHereMessage(res.ok ? "Saved — the club's coaches will see it." : "That didn't save — try again");
    setBusy(false);
  }

  async function saveName() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { ok: true, text: "Name saved." } : { ok: false, text: data.error ?? "That didn't save" });
    setBusy(false);
  }

  async function newPasskey() {
    setBusy(true);
    setPasskeyMessage(null);
    try {
      const key = (await addPasskey()) as PasskeyRow;
      setPasskeys((list) => [key, ...(list ?? [])]);
      setPasskeyMessage({
        ok: true,
        text:
          key.prf === false
            ? "Passkey added — use it to sign in. This browser can't use it to open Financial Admin, so that still needs this device approved."
            : "Passkey added — next time, sign in with it instead of an emailed code.",
      });
    } catch (err) {
      if (!cancelled(err)) setPasskeyMessage({ ok: false, text: err instanceof Error ? err.message : "That didn't work" });
    } finally {
      setBusy(false);
    }
  }

  async function deletePasskey(id: string) {
    if (!confirm("Remove this passkey? You won't be able to sign in with it any more (your email still works).")) return;
    const res = await fetch(`/api/auth/passkey?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setPasskeys((await res.json()).passkeys);
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) window.location.href = "/";
    else {
      setMessage({ ok: false, text: "Couldn't delete the account — try again" });
      setBusy(false);
    }
  }

  // which screen is open: the main list, or one setting (kept in the address's #, so a phone's back gesture works)
  const [screen, setScreen] = useState("");
  const [pushed, setPushed] = useState(false);
  useEffect(() => {
    const read = () => setScreen(window.location.hash.slice(1));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const open = useCallback((id: string) => {
    setPushed(true);
    window.location.hash = id;
  }, []);
  const closeScreen = useCallback(() => {
    if (pushed) window.history.back();
    else {
      window.history.replaceState(null, "", "/account");
      setScreen("");
    }
  }, [pushed]);
  const leave = useCallback(() => {
    // back where you came from in the hub, or home
    if (document.referrer.startsWith(window.location.origin) && window.history.length > 1) window.history.back();
    else window.location.href = "/";
  }, []);
  const { status: alerts } = useJoinRequests();

  if (!account) return <main className="min-h-screen bg-gray-100" />;
  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  const isParent = !!here?.person && (here.person.relation === "parent" || here.person.children.length > 0);
  const initials = (account.user.name || account.user.email)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

  // one setting on its own screen
  const titles: Record<string, string> = {
    details: "Your Details",
    clubs: "Your Clubs",
    here: isParent ? "Your Children" : "Your Team",
    security: "Sign-In & Security",
    alerts: "Notifications",
    delete: "Delete Account",
  };
  if (screen && titles[screen]) {
    return (
      <main className="min-h-screen bg-gray-100 pb-16">
        <TopBar title={titles[screen]} onBack={closeScreen} />
        <div className="mx-auto max-w-xl px-4">
          {screen === "details" && (
            <Group>
              <div className="p-5">
                <label className="block">
                  <span className="text-sm font-bold text-gray-800">Your name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={input} />
                </label>
                <p className="mt-3 text-sm text-gray-500">Email: {account.user.email}</p>
                <button onClick={saveName} disabled={busy || !name.trim() || name === account.user.name} className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40">
                  Save Name
                </button>
                {message && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
                )}
              </div>
            </Group>
          )}

          {screen === "clubs" && (
            <Group>
              {account.clubs.length === 0 ? (
                <p className="p-5 text-sm text-gray-500">You haven&apos;t joined a club yet. Ask your coach for the club code.</p>
              ) : (
                account.clubs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <span className="min-w-0">
                      <span className="block font-bold text-gray-900">{c.name}</span>
                      <span className="block text-sm text-gray-500">
                        {c.status === "approved"
                          ? c.roles.map((r) => ROLES[r]).join(", ") || "Member"
                          : c.status === "pending"
                            ? "Waiting for a coach to approve you"
                            : "Not approved"}
                      </span>
                    </span>
                    {c.status === "approved" && (
                      <a href={c.url} className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Open</a>
                    )}
                  </div>
                ))
              )}
            </Group>
          )}

          {screen === "here" && here?.person && (
            <Group>
              <div className="p-5">
                <p className="mb-3 text-sm text-gray-500">
                  {isParent
                    ? `Their full name and team at ${here.club}, for the club's squad. Only the club's coaches and members see them.`
                    : `Your team at ${here.club}.`}
                </p>
                {isParent ? (
                  <ChildrenEditor value={kids} teams={here.teams} onChange={setKids} clubDecidesTeams />
                ) : (
                  <select value={myTeam} onChange={(e) => setMyTeam(e.target.value)} className={input}>
                    <option value="">Not sure / more than one</option>
                    {here.teams.map((t) => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                )}
                <button onClick={saveHere} disabled={busy} className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40">
                  Save
                </button>
                {hereMessage && <p className="mt-2 text-sm text-gray-600">{hereMessage}</p>}
              </div>
            </Group>
          )}

          {screen === "security" && passkeys && (
            <Group>
              <div className="p-5">
                <h2 className="font-extrabold text-gray-900">Passkeys</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Sign in with Face ID, your fingerprint or your phone&apos;s screen lock instead of an emailed code. Your phone keeps the passkey
                  (Apple and Google sync it to your other devices). Treasurers and club admins can open Financial Admin with it too.
                </p>
                {passkeys.length > 0 && (
                  <ul className="mt-3 divide-y divide-gray-100">
                    {passkeys.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                        <span>
                          <span className="block font-bold text-gray-900">{k.label}</span>
                          <span className="block text-xs text-gray-500">
                            Added {new Date(k.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {k.lastUsedAt && ` · last used ${new Date(k.lastUsedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                          </span>
                        </span>
                        <button onClick={() => deletePasskey(k.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-50">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {canPasskey ? (
                  <button onClick={newPasskey} disabled={busy} className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40">
                    {passkeys.length ? "Add Another Passkey" : "Add a Passkey"}
                  </button>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">This browser can&apos;t use passkeys — try Safari or Chrome.</p>
                )}
                {passkeyMessage && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${passkeyMessage.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{passkeyMessage.text}</p>
                )}
              </div>
            </Group>
          )}

          {screen === "alerts" && <AlertsSettings className="rounded-3xl bg-white p-5 shadow-sm" />}

          {screen === "delete" && (
            <Group>
              <div className="p-5">
                <p className="text-sm text-gray-500">
                  Deletes your account and takes you out of every club. Your clubs keep their own records (like match logs). Type DELETE to confirm.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" className="min-w-0 flex-1 basis-32 rounded-lg border border-red-200 px-3 py-2 text-gray-900 focus:outline-none" />
                  <button onClick={deleteAccount} disabled={busy || confirmDelete !== "DELETE"} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50">
                    Delete My Account
                  </button>
                </div>
                {message && !message.ok && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message.text}</p>}
              </div>
            </Group>
          )}
        </div>
      </main>
    );
  }

  // the main list
  return (
    <main className="min-h-screen bg-gray-100 pb-16">
      <TopBar title="Your Account" onBack={leave} />
      <div className="mx-auto max-w-xl px-4">
        <div className="flex flex-col items-center pb-6 pt-2 text-center">
          <ProfilePhoto initials={initials} />
          <h1 className="mt-4 text-3xl font-semibold text-gray-900">{account.user.name || account.user.email.split("@")[0]}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{account.user.email}</p>
        </div>

        <Group>
          <Row icon={ICONS.person} label="Your Details" onClick={() => open("details")} />
          <Row icon={ICONS.clubs} label="Your Clubs" detail={String(account.clubs.length)} onClick={() => open("clubs")} />
          {here?.person && <Row icon={ICONS.child} label={titles.here} onClick={() => open("here")} />}
        </Group>

        {passkeys && (
          <Group>
            <Row icon={ICONS.key} label="Sign-In & Security" detail={passkeys.length ? `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"}` : undefined} onClick={() => open("security")} />
          </Group>
        )}

        {alerts?.pushAvailable && (
          <Group>
            <Row icon={ICONS.bell} label="Notifications" detail={alerts.alerts ? "On" : "Off"} onClick={() => open("alerts")} />
          </Group>
        )}

        <Group>
          <Row icon={ICONS.shield} label="Privacy Policy" href="/privacy" />
          <Row icon={ICONS.doc} label="Terms" href="/terms" />
        </Group>

        <Group>
          <Row icon={ICONS.out} label="Sign Out" onClick={signOut} />
          <Row icon={ICONS.bin} label="Delete Account" danger onClick={() => open("delete")} />
        </Group>
      </div>
    </main>
  );
}

// ---- the look: a phone's settings ----

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke}>
    {children}
  </svg>
);
const ICONS = {
  person: svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0" /></>),
  clubs: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 0 1 5 5" /></>),
  child: svg(<><circle cx="12" cy="6" r="2.5" /><path d="M8 21v-6l-2-4 6 1 6-1-2 4v6M12 12v4" /></>),
  key: svg(<><circle cx="8" cy="8" r="4.5" /><path d="M11 11l9 9M16 16l2-2M18.5 18.5l2-2" /></>),
  bell: svg(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  shield: svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />),
  doc: svg(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>),
  out: svg(<><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>),
  bin: svg(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>),
};

/** The bar at the top: a round back button and the screen's title. */
function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-30 bg-gray-100/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="relative mx-auto flex h-12 max-w-xl items-center justify-center">
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute left-0 grid h-12 w-12 place-items-center rounded-full bg-white text-gray-900 shadow-md ring-1 ring-black/5 hover:bg-gray-50"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke} strokeWidth={2.4}>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
    </div>
  );
}

/** A rounded group of rows. */
function Group({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm">{children}</div>;
}

/** One row: an icon, a label, maybe a detail, and an arrow. */
function Row({
  icon,
  label,
  detail,
  danger,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={danger ? "text-red-600" : "text-gray-700"}>{icon}</span>
      <span className={`flex-1 text-left text-[17px] ${danger ? "text-red-600" : "text-gray-900"}`}>{label}</span>
      {detail && <span className="text-[15px] text-gray-400">{detail}</span>}
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-300" aria-hidden="true" {...stroke} strokeWidth={2.2}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </>
  );
  const className = "flex w-full items-center gap-4 px-5 py-4 hover:bg-gray-50 active:bg-gray-100";
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
