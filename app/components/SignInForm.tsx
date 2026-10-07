"use client";

// Sign in with your email: we send a 6-digit code (and a link). Type the code
// here — handy when the email opens in a different app — or tap the link.
import { useState } from "react";

export default function SignInForm({ next = "/", onSignedIn }: { next?: string; onSignedIn?: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/start", { email, next });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/auth/code", { email, code });
      if (onSignedIn) onSignedIn();
      else window.location.href = data.next || next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  if (!sent) {
    return (
      <form onSubmit={send} className="flex flex-col gap-4">
        <label>
          <span className="text-sm font-bold text-gray-800">Your email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={input} placeholder="you@example.com" />
          <span className="mt-1 block text-xs text-gray-400">We&apos;ll email you a code — no password needed.</span>
        </label>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
          {busy ? "Sending…" : "Email Me a Code"}
        </button>
      </form>
    );
  }
  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        We&apos;ve emailed a code to <strong>{email}</strong>. It can take a minute — check your junk folder too.
      </p>
      <label>
        <span className="text-sm font-bold text-gray-800">Code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          className={`${input} text-center font-mono text-2xl tracking-[0.3em]`}
        />
      </label>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || code.replace(/\D/g, "").length !== 6} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Checking…" : "Sign In"}
      </button>
      <div className="flex justify-between text-sm font-semibold">
        <button type="button" onClick={() => { setSent(false); setCode(""); setError(null); }} className="text-gray-500 hover:text-gray-800">
          ← Different email
        </button>
        <button type="button" onClick={() => send()} disabled={busy} className="text-green-700 hover:underline disabled:opacity-50">
          Send a new code
        </button>
      </div>
    </form>
  );
}
