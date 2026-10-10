"use client";

// Your account: your name, your clubs and roles, passkeys, a club admin's or
// coach's join request alerts, signing out, and deleting
// the account (which also takes you out of every club).
import Link from "next/link";
import { useEffect, useState } from "react";
import { ROLES, type Child, type MemberStatus, type Relation, type Role } from "@/lib/access";
import ChildrenEditor, { toDrafts, type ChildDraft } from "../components/ChildrenEditor";
import { AlertsSettings } from "../components/JoinAlerts";
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

  if (!account) return <main className="min-h-screen bg-gray-50" />;
  const card = "mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm";
  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-green-700 px-4 py-6 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="text-sm font-medium text-green-200 hover:text-white">← Home</Link>
          <h1 className="mt-2 text-xl font-extrabold">👤 Your Account</h1>
          <p className="mt-0.5 text-sm text-green-200">{account.user.email}</p>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4">
        <section className={card}>
          <label className="block">
            <span className="text-sm font-bold text-gray-800">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={input} />
          </label>
          <button onClick={saveName} disabled={busy || !name.trim() || name === account.user.name} className="mt-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40">
            Save Name
          </button>
          {message && (
            <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
          )}
        </section>

        <section className={card}>
          <h2 className="font-extrabold text-gray-900">Your Clubs</h2>
          {account.clubs.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">You haven&apos;t joined a club yet. Ask your coach for the club code.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {account.clubs.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <span>
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
                    <a href={c.url} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Open</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {here?.person && (
          <section className={card}>
            <h2 className="font-extrabold text-gray-900">
              {here.person.relation === "parent" || here.person.children.length ? `Your Children at ${here.club}` : `Your Team at ${here.club}`}
            </h2>
            {here.person.relation === "parent" || here.person.children.length ? (
              <>
                <p className="mt-1 mb-3 text-sm text-gray-500">
                  Their full name and team, for the club&apos;s squad. Only the club&apos;s coaches and members see them.
                </p>
                <ChildrenEditor value={kids} teams={here.teams} onChange={setKids} clubDecidesTeams />
              </>
            ) : (
              <select value={myTeam} onChange={(e) => setMyTeam(e.target.value)} className={`${input} mt-3`}>
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
          </section>
        )}

        {passkeys && (
          <section className={card} id="passkeys">
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
          </section>
        )}

        <AlertsSettings className={card} />

        <section className={card}>
          <button onClick={signOut} className="w-full rounded-xl border border-gray-200 py-3 font-bold text-gray-700 hover:bg-gray-50">
            Sign Out
          </button>
        </section>

        <section className={`${card} border-red-100`}>
          <h2 className="font-extrabold text-red-700">Delete Account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Deletes your account and takes you out of every club. Your clubs keep their own records (like match logs). Type DELETE to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" className="min-w-0 flex-1 basis-32 rounded-lg border border-red-200 px-3 py-2 text-gray-900 focus:outline-none" />
            <button onClick={deleteAccount} disabled={busy || confirmDelete !== "DELETE"} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50">
              Delete My Account
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
