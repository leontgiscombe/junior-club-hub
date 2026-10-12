"use client";

// Your Account → Your Details: the email you sign in with, and changing it.
// A code goes to the new address first (app/api/account/email), so a typo
// can't lock you out.
import { useState } from "react";

export default function EmailChange({ email, onChanged }: { email: string; onChanged: (email: string) => void }) {
  const [step, setStep] = useState<"shown" | "new" | "code">("shown");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(method: "POST" | "PUT", body: Record<string, string>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/email", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      return data as { email?: string };
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "That didn't work" });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-transparent dark:text-gray-50";
  const primary = "rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200";
  const quiet = "rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200";
  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">Email</span>
          <span className="block truncate text-[15px] text-gray-600 dark:text-gray-300">{email}</span>
        </span>
        {step === "shown" && (
          <button onClick={() => { setStep("new"); setMessage(null); }} className="shrink-0 text-sm font-semibold text-green-700 dark:text-green-400">
            Change
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">You sign in with this, and the club&apos;s emails come here.</p>

      {step === "new" && (
        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("POST", { email: next })) {
              setStep("code");
              setCode("");
            }
          }}
        >
          <label className="block">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">New email address</span>
            <input type="email" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="email" autoFocus className={input} />
          </label>
          <div className="mt-3 flex gap-2">
            <button disabled={busy || !next.includes("@")} className={primary}>
              {busy ? "Sending…" : "Send a Code"}
            </button>
            <button type="button" onClick={() => setStep("shown")} className={quiet}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const done = await call("PUT", { code });
            if (done?.email) {
              onChanged(done.email);
              setStep("shown");
              setMessage({ ok: true, text: `Done — you now sign in with ${done.email}.` });
            }
          }}
        >
          <label className="block">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">The code we sent to {next.trim().toLowerCase()}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              aria-label="Six-digit code"
              autoFocus
              className={`${input} font-mono text-lg tracking-[0.3em]`}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy || code.length !== 6} className={primary}>
              {busy ? "Checking…" : "Change My Email"}
            </button>
            <button type="button" disabled={busy} onClick={() => call("POST", { email: next }).then((ok) => ok && setMessage({ ok: true, text: "A new code is on its way." }))} className={quiet}>
              Send Again
            </button>
            <button type="button" onClick={() => setStep("new")} className={quiet}>
              Back
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">Not there? Check your junk folder. The code works for 15 minutes.</p>
        </form>
      )}

      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
