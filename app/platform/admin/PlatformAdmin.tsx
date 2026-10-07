"use client";

// The platform admin: sign in with PLATFORM_ADMIN_KEY, then see every club,
// send one a password-reset email, or delete one with all its data. The key
// is kept for this browser tab only.
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminClub = { id: string; name: string; email: string; createdAt: string };
type Backup = { date: string; at: string; keys: number };

const KEY_STORE = "platform-admin-key";

const clubUrl = (id: string, root: string) =>
  `${/^localhost(:|$)/.test(root) ? "http" : "https"}://${id}.${root}`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function PlatformAdmin({ rootDomain }: { rootDomain: string }) {
  const [key, setKey] = useState("");
  const [typedKey, setTypedKey] = useState("");
  const [clubs, setClubs] = useState<AdminClub[] | null>(null);
  const [emailReady, setEmailReady] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [separateBackups, setSeparateBackups] = useState(true);
  const [restoreId, setRestoreId] = useState("");
  const [restoreDate, setRestoreDate] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const call = useCallback(
    async (k: string, init?: { action: string; id: string; confirm?: string; date?: string }) => {
      const res = await fetch("/api/platform-admin", {
        method: init ? "POST" : "GET",
        headers: { "x-platform-key": k, ...(init ? { "Content-Type": "application/json" } : {}) },
        body: init ? JSON.stringify(init) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error ?? "Something went wrong"), { status: res.status });
      return data;
    },
    [],
  );

  const load = useCallback(
    async (k: string) => {
      setBusy(true);
      setError(null);
      try {
        const data = await call(k);
        setClubs(data.clubs);
        setEmailReady(data.emailConfigured);
        setBackups(data.backups ?? []);
        setSeparateBackups(data.separateBackups ?? true);
        setKey(k);
        try {
          sessionStorage.setItem(KEY_STORE, k);
        } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        if ((err as { status?: number }).status === 401) {
          setKey("");
          try {
            sessionStorage.removeItem(KEY_STORE);
          } catch {}
        }
      } finally {
        setBusy(false);
      }
    },
    [call],
  );

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(KEY_STORE) ?? "";
    } catch {}
    // (after this render, so the effect itself doesn't set state)
    if (saved) void Promise.resolve().then(() => load(saved));
  }, [load]);

  async function act(action: "reset" | "delete" | "restore", id: string, confirm?: string, date?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await call(key, { action, id, confirm, date });
      setNotice(data.message);
      if (action === "delete") {
        setDeleting(null);
        setConfirmText("");
        setClubs((c) => c?.filter((x) => x.id !== id) ?? null);
      }
      if (action === "restore") {
        setRestoreConfirm("");
        await load(key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!clubs) return [];
    if (!q) return clubs;
    return clubs.filter((c) => [c.id, c.name, c.email].some((v) => v.toLowerCase().includes(q)));
  }, [clubs, search]);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return (clubs ?? []).filter((c) => {
      const d = new Date(c.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [clubs]);

  if (!key || !clubs) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(typedKey.trim());
        }}
        className="mt-6 max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-lg"
      >
        <label className="block text-sm font-bold text-gray-700" htmlFor="admin-key">
          Admin key
        </label>
        <input
          id="admin-key"
          type="password"
          autoComplete="current-password"
          value={typedKey}
          onChange={(e) => setTypedKey(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-green-600 focus:outline-none"
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !typedKey.trim()}
          className="mt-4 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Sign In"}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-3xl font-extrabold text-gray-900">{clubs.length}</p>
          <p className="text-sm text-gray-500">Clubs</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-3xl font-extrabold text-gray-900">{thisMonth}</p>
          <p className="text-sm text-gray-500">Signed up this month</p>
        </div>
      </div>

      {!emailReady && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          Email isn&apos;t set up yet (RESEND_API_KEY and EMAIL_FROM), so emails go to the server log.
        </p>
      )}
      {notice && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800">{notice}</p>}
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search by name, address or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-green-600 focus:outline-none"
        />
        <button
          onClick={() => load(key)}
          disabled={busy}
          className="rounded-xl border border-gray-300 bg-white px-4 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          {clubs.length ? "No clubs match that search." : "No clubs have signed up yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => (
            <li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-gray-900">{c.name}</p>
                  <a
                    href={clubUrl(c.id, rootDomain)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-semibold text-green-700 underline"
                  >
                    {c.id}.{rootDomain}
                  </a>
                  <p className="truncate text-sm text-gray-600">
                    <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a> · joined {day(c.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act("reset", c.id)}
                    disabled={busy}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Send Password Reset
                  </button>
                  <button
                    onClick={() => {
                      setDeleting(deleting === c.id ? null : c.id);
                      setConfirmText("");
                    }}
                    disabled={busy}
                    className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {deleting === c.id && (
                <div className="mt-3 rounded-xl bg-red-50 p-3">
                  <p className="text-sm text-red-800">
                    This deletes <strong>{c.name}</strong> and everything in its hub, for good. Type{" "}
                    <strong>{c.id}</strong> to confirm.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      aria-label="Type the club's address to confirm"
                      className="min-w-0 flex-1 basis-40 rounded-lg border border-red-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
                    />
                    <button
                      onClick={() => act("delete", c.id, confirmText)}
                      disabled={busy || confirmText !== c.id}
                      className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete Club
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="font-extrabold text-gray-900">🗄️ Backups</h2>
        <p className="mt-1 text-sm text-gray-500">
          Everything is backed up every morning and kept for 7 days.
          {!separateBackups && " They're in the main database for now — add a second Upstash database (BACKUP_KV_REST_API_URL / BACKUP_KV_REST_API_TOKEN) so they'd survive losing it."}
        </p>
        {backups.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No backups yet — the first runs at 9am UTC.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {backups.map((b) => (
              <li key={b.date}>
                <strong>{day(b.date)}</strong> · {new Date(b.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {b.keys} records
              </li>
            ))}
          </ul>
        )}
        {backups.length > 0 && (
          <div className="mt-4 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-bold text-gray-800">Restore a club</p>
            <p className="mt-1 text-xs text-gray-500">
              Puts one club back exactly as it was in that backup, replacing what it has now. Works for a deleted club too.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={restoreId}
                onChange={(e) => setRestoreId(e.target.value.trim().toLowerCase())}
                placeholder="club address"
                aria-label="Club address to restore"
                className="min-w-0 flex-1 basis-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
              />
              <select
                value={restoreDate}
                onChange={(e) => setRestoreDate(e.target.value)}
                aria-label="Backup to restore from"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
              >
                <option value="">Which backup…</option>
                {backups.map((b) => (
                  <option key={b.date} value={b.date}>{day(b.date)}</option>
                ))}
              </select>
            </div>
            {restoreId && restoreDate && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.value)}
                  placeholder={`type ${restoreId} to confirm`}
                  aria-label="Type the club's address to confirm"
                  className="min-w-0 flex-1 basis-40 rounded-lg border border-amber-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
                />
                <button
                  onClick={() => act("restore", restoreId, restoreConfirm, restoreDate)}
                  disabled={busy || restoreConfirm !== restoreId}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Restore Club
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <button
        onClick={() => {
          try {
            sessionStorage.removeItem(KEY_STORE);
          } catch {}
          setKey("");
          setClubs(null);
          setTypedKey("");
        }}
        className="text-sm font-semibold text-gray-500 hover:text-gray-800"
      >
        Sign out
      </button>
    </div>
  );
}
