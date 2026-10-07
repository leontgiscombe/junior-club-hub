"use client";

// Forgot the coach password: ask for a reset link by email, then (from the
// link) choose a new password.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useClub } from "../components/ClubProvider";

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export default function ResetPassword() {
  const club = useClub();
  const [token, setToken] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (t) call({ action: "check", token: t }).then((d) => setValid(!!d.valid), () => setValid(false));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMessage((await call({ action: "request", email })).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await call({ action: "reset", token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  const button =
    "mt-4 w-full cursor-pointer rounded-xl bg-gray-900 py-3 font-bold text-white hover:bg-black disabled:opacity-40";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--club-night)] px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={club.crest.src} alt={club.crest.alt} className="mx-auto mb-3 h-16 w-auto" />
        <h1 className="text-center text-xl font-extrabold text-gray-900">Reset the Coach Password</h1>
        <p className="mt-1 text-center text-sm text-gray-500">{club.fullName}</p>

        {done ? (
          <div className="mt-5 text-center">
            <p className="text-sm text-gray-700">
              The new password is set. Share it with your coaches; the old one no longer works.
            </p>
            <Link href="/admin" className={`${button} block`}>
              Sign In to Coach Admin
            </Link>
          </div>
        ) : token ? (
          valid === null ? (
            <p className="mt-5 text-center text-sm text-gray-500">Checking the link…</p>
          ) : !valid ? (
            <div className="mt-5 text-center">
              <p className="text-sm text-gray-700">This link has expired or has already been used.</p>
              <Link href="/reset-password" className={`${button} block`}>
                Send a New Link
              </Link>
            </div>
          ) : (
            <form onSubmit={reset} className="mt-5">
              <label className="block">
                <span className="text-sm font-bold text-gray-800">New coach password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" className={input} />
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-bold text-gray-800">New password again</span>
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required autoComplete="new-password" className={input} />
              </label>
              {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
              <button disabled={busy} className={button}>{busy ? "Saving…" : "Set New Password"}</button>
            </form>
          )
        ) : message ? (
          <p className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-center text-sm text-green-800">{message}</p>
        ) : (
          <form onSubmit={request} className="mt-5">
            <p className="text-sm text-gray-600">
              Enter the email the club signed up with, and we&apos;ll send a link to choose a new
              password.
            </p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className={`${input} mt-3`} />
            {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
            <button disabled={busy || !email} className={button}>{busy ? "Sending…" : "Send Reset Link"}</button>
          </form>
        )}

        <Link href="/admin" className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
