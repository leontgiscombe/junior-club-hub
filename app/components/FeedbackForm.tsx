"use client";

// Help & Feedback: a question, a problem or a suggestion, sent to the
// platform (app/api/feedback). Signed in, it's sent as you; otherwise it asks
// for your email, so we can reply.
import { useEffect, useState } from "react";

const KINDS = [
  { id: "question", label: "Question" },
  { id: "problem", label: "Report a Problem" },
  { id: "idea", label: "Suggestion" },
] as const;

export default function FeedbackForm({ signedIn, initialKind = "question" }: { signedIn: boolean; initialKind?: string }) {
  const [kind, setKind] = useState<string>(initialKind);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // the page they came from, for a problem report
  const [from, setFrom] = useState("");
  useEffect(() => {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- only known in the browser
      if (ref && ref.origin === window.location.origin) setFrom(ref.pathname + ref.hash);
    } catch {}
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, message, email, name, page: from }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setSent(true);
    else setError(data.error ?? "That didn't send — check you're online and try again");
    setBusy(false);
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-transparent dark:text-gray-50";
  if (sent) {
    return (
      <div className="rounded-2xl bg-green-50 px-4 py-5 text-center text-green-900 dark:bg-green-400/10 dark:text-green-200">
        <div className="text-3xl">✅</div>
        <p className="mt-1 font-bold">Thanks — it&apos;s on its way</p>
        <p className="mt-1 text-sm opacity-80">We&apos;ll reply by email, usually within a couple of days.</p>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is it?">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-full px-3.5 py-2 text-sm font-bold ${
              kind === k.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <label>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
          {kind === "problem" ? "What happened, and what were you trying to do?" : kind === "idea" ? "Your idea" : "Your question"}
        </span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} maxLength={3000} className={input} />
      </label>
      {!signedIn && (
        <>
          <label>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Your email (so we can reply)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={input} />
          </label>
          <label>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Your name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={input} />
          </label>
        </>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
      <button disabled={busy || message.trim().length < 3} className="rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Sending…" : "Send"}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {kind === "problem" ? "We'll also see which page you came from and your phone or browser type, to help find it. " : ""}
        Please don&apos;t include children&apos;s medical details.
      </p>
    </form>
  );
}
