"use client";

// Your account, laid out like a phone's settings: your photo and name at the
// top, then grouped rows that each open their own screen (#details, #clubs,
// #here, #team, #security, #appearance, #tabs, #alerts, #delete) — your name, your clubs and roles, your
// children or team, passkeys, a club admin's or coach's join request alerts,
// signing out, and deleting the account (which also takes you out of every club).
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_CHILDREN, ROLES, type Child, type MemberStatus, type Relation, type Role } from "@/lib/access";
import ChildrenEditor, { toDrafts, type ChildDraft } from "../components/ChildrenEditor";
import NameFields from "../components/NameFields";
import EmailChange from "./EmailChange";
import { AlertsSettings, useJoinRequests } from "../components/JoinAlerts";
import { ChildAvatar } from "./ChildPhotos";
import ProfilePhoto from "./ProfilePhoto";
import AppearancePicker, { themeLabel } from "./AppearancePicker";
import TabBarPicker from "./TabBarPicker";
import { Group, ICONS, Row, ToolTabs, TopBar, useScreens } from "../components/SettingsUI";
import { canGoBack } from "@/lib/back";
import { addPasskey, cancelled, supportsPasskeys } from "../components/passkey";

type PasskeyRow = { id: string; label: string; prf: boolean | null; createdAt: string; lastUsedAt: string | null };

// "Your Children" (#here) for a parent, as any parent sees it; "Your Team"
// (#team, or #here for someone with no children to list) for anyone who isn't
// only a parent — so a coach who's a parent has both. Any club staff can add a
// child of theirs who plays.
const STAFF: Role[] = ["admin", "coach", "treasurer"];
function hereShows(p: NonNullable<Here["person"]>) {
  const parent = p.relation === "parent" || p.children.length > 0 || (p.roles ?? []).includes("parent");
  const staff = (p.roles ?? []).some((r) => STAFF.includes(r));
  return { kids: parent || staff, team: staff || !parent, parent };
}
const startKids = (p: NonNullable<Here["person"]>) =>
  p.children.length ? toDrafts(p.children) : hereShows(p).parent ? [{ name: "", team: "" }] : [];

type Here = {
  club: string;
  person: { status: MemberStatus; roles: Role[]; relation: Relation | null; team: { slug: string } | null; children: Child[] } | null;
  teams: { slug: string; name: string }[];
  /** their children's photo versions, by squad player id */
  photos?: Record<string, string>;
};

type Account = {
  user: { email: string; name: string; phone?: string };
  clubs: { id: string; name: string; url: string; roles: Role[]; status: MemberStatus }[];
  /** the platform admin's address, for whoever runs the platform */
  platformAdmin?: string | null;
};

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  // this club (on a club's own address): your children, or your team
  const [here, setHere] = useState<Here | null>(null);
  const [kids, setKids] = useState<ChildDraft[]>([]);
  // each child's photo version, by squad player id
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [myTeam, setMyTeam] = useState("");
  const [hereMessage, setHereMessage] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
  const [canPasskey, setCanPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // the children and team last shown from the server: a newer copy replaces them unless they've been edited since
  const shownKids = useRef("");
  const shownTeam = useRef("");

  /** This club's copy of your children and team — again whenever it may have changed (a coach approving a child). */
  const loadHere = useCallback(async (force = false) => {
    const h = await fetch("/api/me/club", { cache: "no-store" }).catch(() => null);
    if (!h?.ok) return;
    const hd = (await h.json()) as Here;
    if (!hd.person) return;
    setHere(hd);
    setPhotos(hd.photos ?? {});
    const k = startKids(hd.person);
    setKids((prev) => {
      if (force || JSON.stringify(prev) === shownKids.current) {
        shownKids.current = JSON.stringify(k);
        return k;
      }
      // being edited: what you've typed stays, and each child's place in the
      // squad (waiting, or in with their team) comes up to date
      const fresh = new Map(k.flatMap((c) => (c.id ? [[c.id, c]] : [])));
      return prev.map((c) => {
        const f = c.id ? fresh.get(c.id) : undefined;
        if (!f) return c;
        return f.playerId
          ? { id: c.id, name: c.name, team: f.team, playerId: f.playerId, linked: true, teamLabel: f.teamLabel }
          : { id: c.id, name: c.name, team: c.team, ...(f.pending ? { pending: true } : {}) };
      });
    });
    const t = hd.person.team?.slug ?? "";
    setMyTeam((prev) => {
      if (!force && prev !== shownTeam.current) return prev;
      shownTeam.current = t;
      return t;
    });
  }, []);

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then(async (res) => {
      if (res.status === 401) {
        window.location.href = "/signin?next=/account";
        return;
      }
      const data = (await res.json()) as Account;
      setAccount(data);
      setName(data.user.name);
      setPhone(data.user.phone ?? "");
      setCanPasskey(supportsPasskeys());
      fetch("/api/auth/passkey", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { passkeys: [] }))
        .then((d) => setPasskeys(d.passkeys));
      await loadHere(true);
    });
  }, [loadHere]);

  async function saveHere(part: "kids" | "team", nextKids = kids): Promise<boolean> {
    if (!here?.person || busy) return false;
    setBusy(true);
    setHereMessage(null);
    try {
    const res = await fetch("/api/me/club", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(part === "kids" ? { children: nextKids.filter((k) => k.name.trim()) } : { team: myTeam }),
    });
    if (res.ok) {
      const saved = ((await res.json().catch(() => null)) as { person?: Here["person"] } | null)?.person;
      if (saved) {
        setHere({ ...here, person: saved });
        if (part === "kids") {
          const k = startKids(saved);
          shownKids.current = JSON.stringify(k);
          setKids(k);
        } else shownTeam.current = myTeam;
      }
      const waiting = part === "kids" && saved?.children.some((c) => c.pending);
      const straightIn = part === "kids" && saved?.children.some((c) => c.playerId && !here.person!.children.some((o) => o.id === c.id && o.playerId));
      const kept = new Set((saved?.children ?? []).flatMap((c) => (c.playerId ? [c.playerId] : [])));
      const removed = here.person.children.some((c) => c.playerId && !kept.has(c.playerId));
      setHereMessage(
        waiting
          ? "Saved. A coach will add any new children to the squad."
          : straightIn
            ? "Saved — they're in the squad."
            : removed
            ? "Saved. The club's coaches have been told."
            : "Saved — the club's coaches will see it.",
      );
      return true;
    } else {
      setHereMessage("That didn't save — try again");
      return false;
    }
    } catch {
      setHereMessage("Couldn't connect. Your changes have not been saved.");
      return false;
    } finally { setBusy(false); }
  }

  async function saveName() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAccount((a) => (a ? { ...a, user: { ...a.user, name, phone: phone.trim() } } : a));
    setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error ?? "That didn't save" });
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
            ? "Passkey added — use it to sign in."
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
      const why = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      setMessage({ ok: false, text: why ?? "Couldn't delete the account — try again" });
      setBusy(false);
    }
  }

  // which screen is open: the main list, or one setting
  const { screen, open, switchTo, close: closeScreen } = useScreens("/account");
  const accountView = screen === "preferences" || screen === "security-home" ? screen : "family";
  useEffect(() => {
    let previous = window.location.hash.slice(1);
    const discardChildDraft = () => {
      const next = window.location.hash.slice(1);
      if (previous.startsWith("child-") && previous !== next) {
        try { setKids(JSON.parse(shownKids.current || "[]") as ChildDraft[]); } catch {}
      }
      previous = next;
    };
    window.addEventListener("hashchange", discardChildDraft);
    return () => window.removeEventListener("hashchange", discardChildDraft);
  }, []);
  const childIndex = kids.findIndex((child, index) => screen === `child-${child.id ?? `draft-${index}`}`);
  const selectedChild = childIndex >= 0 ? kids[childIndex] : null;
  const childScreen = screen.startsWith("child-");
  const leaveDetail = () => {
    if (busy) return;
    if (childScreen) {
      try { setKids(JSON.parse(shownKids.current || "[]") as ChildDraft[]); } catch {}
      setHereMessage(null);
    }
    closeScreen();
  };
  const leave = useCallback(() => {
    // back where you came from in the hub, or home
    if (canGoBack()) window.history.back();
    else window.location.href = "/";
  }, []);
  const approvedSomewhere = !!account?.clubs.some((club) => club.status === "approved");
  const { status: alerts } = useJoinRequests(undefined, approvedSomewhere);

  // kept up to date without going out and back in: on opening your children or
  // team, on coming back to the app, and every few seconds while a child waits
  // for a coach
  useEffect(() => {
    if (screen !== "here" && screen !== "team" && !screen.startsWith("child-")) return;
    const t = window.setTimeout(() => loadHere(), 0);
    return () => window.clearTimeout(t);
  }, [screen, loadHere]);
  const waiting = !!here?.person?.children.some((c) => c.pending);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") loadHere();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const every = waiting ? window.setInterval(() => document.visibilityState === "visible" && loadHere(), 10000) : 0;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (every) window.clearInterval(every);
    };
  }, [waiting, loadHere]);

  if (!account) return <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black" />;
  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";
  const shows = here?.person ? hereShows(here.person) : { kids: false, team: true, parent: false };
  const initials = (account.user.name || account.user.email)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
  function addChild() {
    setHereMessage(null);
    const empty = kids.findIndex((child) => !child.name.trim() && !child.id);
    if (empty >= 0) { open(`child-draft-${empty}`); return; }
    if (kids.length >= MAX_CHILDREN) return;
    setKids([...kids, { name: "", team: "" }]);
    open(`child-draft-${kids.length}`);
  }
  const childList = <>
    <div className="mt-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Your Children</h2><button disabled={busy || kids.filter((child) => child.name.trim()).length >= MAX_CHILDREN} onClick={addChild} className="min-h-11 px-2 text-sm font-semibold text-green-700 disabled:opacity-40 dark:text-green-400">Add Child</button></div>
    <Group>{kids.map((child, index) => child.name.trim() ? <Row key={child.id ?? `draft-${index}`} icon={ICONS.child} label={child.name} detail={child.pending ? "Pending approval" : here?.teams.find((team) => team.slug === child.team)?.name ?? "No team yet"} onClick={() => { setHereMessage(null); open(`child-${child.id ?? `draft-${index}`}`); }} /> : null)}</Group>
    {!kids.some((child) => child.name.trim()) && <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No children added yet.</p>}
    {hereMessage && <p role="status" className="mt-3 text-sm text-gray-600 dark:text-gray-300">{hereMessage}</p>}
  </>;

  // one setting on its own screen
  const titles: Record<string, string> = {
    details: "Your Details",
    clubs: "Your Clubs",
    here: shows.kids ? "Your Children" : "Your Team",
    team: "Your Team",
    security: "Sign-In & Security",
    alerts: "Notifications",
    appearance: "Appearance",
    tabs: "Tab Bar",
    delete: "Delete Account",
    ...(childScreen ? { [screen]: selectedChild?.name || "Child Details" } : {}),
  };
  if (screen && titles[screen]) {
    return (
      <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black pb-16">
        <TopBar title={titles[screen]} onBack={leaveDetail} />
        <div className="mx-auto max-w-xl px-4">
          {screen === "details" && (
            <Group>
              <div className="p-5">
                <div className="mb-6 flex justify-center"><ProfilePhoto initials={initials} /></div>
                <label className="block">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Your name</span>
                  <NameFields value={name} onChange={setName} label="Your" autoComplete className={input} />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Mobile number</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={24}
                    placeholder="e.g. 07700 900123"
                    className={input}
                  />
                  <span className="mt-1 block text-xs text-gray-400">So your club can reach you, e.g. a WhatsApp reminder about subs. Only its coaches and treasurer see it.</span>
                </label>
                <button onClick={saveName} disabled={busy || !name.trim() || !phone.trim() || (name === account.user.name && phone.trim() === (account.user.phone ?? ""))} className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40 dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900">
                  Save
                </button>
                {message && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"}`}>{message.text}</p>
                )}
              </div>
            </Group>
          )}
          {screen === "details" && (
            <Group>
              <EmailChange email={account.user.email} onChanged={(email) => setAccount((a) => (a ? { ...a, user: { ...a.user, email } } : a))} />
            </Group>
          )}

          {screen === "clubs" && (
            <Group>
              {account.clubs.length === 0 ? (
                <p className="p-5 text-sm text-gray-500 dark:text-gray-400">
                  You haven&apos;t joined a club yet.{" "}
                  <a href="/join" className="font-semibold text-green-700 dark:text-green-400">Join this club →</a>
                </p>
              ) : (
                account.clubs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <span className="min-w-0">
                      <span className="block font-bold text-gray-900 dark:text-gray-50">{c.name}</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400">
                        {c.status === "approved"
                          ? c.roles.map((r) => ROLES[r]).join(", ") || "Member"
                          : c.status === "pending"
                            ? "Waiting for a coach to approve you"
                            : "Not approved"}
                      </span>
                    </span>
                    {c.status === "approved" && (
                      <a href={c.url} className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15">Open</a>
                    )}
                  </div>
                ))
              )}
            </Group>
          )}

          {screen === "here" && shows.kids && here?.person && (
            <div className="pb-5">{childList}</div>
          )}

          {childScreen && shows.kids && here?.person && selectedChild && (
            <Group>
              <div className="p-5">
                <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                  {`Their full name and team at ${here.club}, for the club's squad. Only the club's coaches and members see them.`}
                </p>
                <fieldset disabled={busy} className="min-w-0">
                <ChildrenEditor
                  value={[selectedChild]}
                  teams={here.teams}
                  onChange={(next) => setKids((all) => all.map((child, index) => index === childIndex ? next[0] : child))}
                  clubDecidesTeams
                  showAdd={false}
                  allowRemove={false}
                  // each child's card is headed by their photo, once they're in the squad
                  photo={(c, info) => (
                    <ChildAvatar
                      playerId={here.person?.status === "approved" ? c.playerId : undefined}
                      name={c.name}
                      version={c.playerId ? photos[c.playerId] : undefined}
                      onChange={(v) =>
                        c.playerId &&
                        setPhotos((all) => {
                          const next = { ...all };
                          if (v) next[c.playerId!] = v;
                          else delete next[c.playerId!];
                          return next;
                        })
                      }
                    >
                      {info}
                    </ChildAvatar>
                  )}
                />
                <button onClick={async () => { if (await saveHere("kids") && window.location.hash.slice(1) === screen) closeScreen(); }} disabled={busy || !selectedChild.name.trim()} className="mt-3 flex min-h-11 items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                  {ICONS.doc}{busy ? "Saving..." : "Save Child"}
                </button>
                </fieldset>
                {selectedChild.id && <button disabled={busy} onClick={async () => {
                  if (!confirm(`Remove ${selectedChild.name} from your account? They stay in the club's squad and the club's coaches are told.`)) return;
                  if (await saveHere("kids", kids.filter((_, index) => index !== childIndex)) && window.location.hash.slice(1) === screen) closeScreen();
                }} className="mt-4 flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-40 dark:text-red-400">{ICONS.bin}Remove Child</button>}
                {hereMessage && <p role="status" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{hereMessage}</p>}
              </div>
            </Group>
          )}
          {childScreen && !selectedChild && <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">This child is no longer on your account.</p>}

          {(screen === "team" || (screen === "here" && !shows.kids)) && here?.person && (
            <Group>
              <div className="p-5">
                <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Your team at {here.club}.</p>
                <select value={myTeam} onChange={(e) => setMyTeam(e.target.value)} className={input}>
                  <option value="">Not sure / more than one</option>
                  {here.teams.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
                <button onClick={() => saveHere("team")} disabled={busy} className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40 dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900">
                  Save
                </button>
                {hereMessage && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{hereMessage}</p>}
              </div>
            </Group>
          )}

          {screen === "security" && passkeys && (
            <Group>
              <div className="p-5">
                <h2 className="font-extrabold text-gray-900 dark:text-gray-50">Passkeys</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Sign in with Face ID, your fingerprint or your phone&apos;s screen lock instead of an emailed code. Your phone keeps the passkey
                  (Apple and Google sync it to your other devices). Treasurers and club admins can open Finances with it too.
                </p>
                {passkeys.length > 0 && (
                  <ul className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
                    {passkeys.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                        <span>
                          <span className="block font-bold text-gray-900 dark:text-gray-50">{k.label}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            Added {new Date(k.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {k.lastUsedAt && ` · last used ${new Date(k.lastUsedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                          </span>
                        </span>
                        <button onClick={() => deletePasskey(k.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-300 dark:border-white/15">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {canPasskey ? (
                  <button onClick={newPasskey} disabled={busy} className="mt-3 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40 dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900">
                    {passkeys.length ? "Add Another Passkey" : "Add a Passkey"}
                  </button>
                ) : (
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">This browser can&apos;t use passkeys — try Safari or Chrome.</p>
                )}
                {passkeyMessage && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${passkeyMessage.ok ? "bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"}`}>{passkeyMessage.text}</p>
                )}
              </div>
            </Group>
          )}

          {screen === "appearance" && <AppearancePicker />}

          {screen === "tabs" && <TabBarPicker />}

          {screen === "alerts" && <AlertsSettings className="rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]" />}

          {screen === "delete" && (
            <Group>
              <div className="p-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Deletes your account and takes you out of every club. Your clubs keep their own records (like match logs). Type DELETE to confirm.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 basis-32 rounded-lg border border-red-200 px-3 py-2 text-gray-900 focus:outline-none dark:text-gray-50 dark:border-red-400/30" />
                  <button onClick={deleteAccount} disabled={busy || confirmDelete.trim().toUpperCase() !== "DELETE"} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50">
                    Delete My Account
                  </button>
                </div>
                {message && !message.ok && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{message.text}</p>}
              </div>
            </Group>
          )}
        </div>
      </main>
    );
  }

  // the main list
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black pb-16">
      <TopBar title="Your Account" onBack={leave} />
      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="mb-5 flex items-center gap-4">
          <ProfilePhoto initials={initials} compact />
          <div className="min-w-0"><h1 className="break-words text-xl font-bold text-gray-900 dark:text-gray-50">{account.user.name || account.user.email.split("@")[0]}</h1><p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">{account.user.email}</p></div>
        </div>
        <ToolTabs label="Account views" tabs={[{ id: "family", label: "Family" }, { id: "preferences", label: "Preferences" }, { id: "security-home", label: "Security" }]} value={accountView} onChange={switchTo} panelId="account-panel" />
        <div id="account-panel" role="tabpanel" aria-label={accountView === "security-home" ? "Security" : accountView === "preferences" ? "Preferences" : "Family"}>

        <div hidden={accountView !== "family"}>
        <Group>
          <Row icon={ICONS.person} label="Your Details" onClick={() => open("details")} />
          <Row icon={ICONS.clubs} label="Your Clubs" detail={String(account.clubs.length)} onClick={() => open("clubs")} />
          {here?.person && !shows.kids && <Row icon={ICONS.child} label={titles.here} onClick={() => open("here")} />}
          {here?.person && shows.kids && shows.team && <Row icon={ICONS.clubs} label="Your Team" onClick={() => open("team")} />}
        </Group>
        {here?.person && shows.kids && childList}
        </div>

        <div hidden={accountView !== "security-home"}>
        {passkeys && (
          <Group>
            <Row icon={ICONS.key} label="Sign-In & Security" detail={passkeys.length ? `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"}` : undefined} onClick={() => open("security")} />
          </Group>
        )}
        </div>

        <div hidden={accountView !== "preferences"}>
        <Group>
          <Row icon={ICONS.moon} label="Appearance" detail={themeLabel()} onClick={() => open("appearance")} />
          <Row icon={ICONS.grid} label="Tab Bar" onClick={() => open("tabs")} />
          {alerts?.pushAvailable && (
            <Row icon={ICONS.bell} label="Notifications" detail={alerts.alerts ? "On" : "Off"} onClick={() => open("alerts")} />
          )}
        </Group>
        </div>

        <div hidden={accountView !== "security-home"}>
        {account.platformAdmin && (
          <Group>
            <Row icon={ICONS.shield} label="Platform Admin" detail="Every club" href={account.platformAdmin} />
          </Group>
        )}
        <Group>
          <Row icon={ICONS.help} label="Help & Feedback" href="/support" />
          <Row icon={ICONS.shield} label="Privacy Policy" href="/privacy" />
          <Row icon={ICONS.doc} label="Terms" href="/terms" />
        </Group>

        <Group>
          <Row icon={ICONS.out} label="Sign Out" onClick={signOut} />
          <Row icon={ICONS.bin} label="Delete Account" danger onClick={() => open("delete")} />
        </Group>
        </div>
        </div>
      </div>
    </main>
  );
}
