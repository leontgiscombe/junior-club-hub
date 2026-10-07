"use client";

// Ask to join: the club's code, your name and who you are. Then this phone
// waits for a coach to approve it (checking every so often by itself).
import { useEffect, useState } from "react";

type Status = "none" | "pending" | "approved" | "declined";

export default function JoinForm({ initialStatus, initialCode }: { initialStatus: Status; initialCode: string }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askAgain, setAskAgain] = useState(false);

  // while waiting, look every 15 seconds for the coach's answer
  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(async () => {
      const res = await fetch("/api/join", { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (data?.status === "approved") window.location.href = "/";
      else if (data?.status) setStatus(data.status);
    }, 15000);
    return () => clearInterval(t);
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.status === "open") window.location.href = "/";
      else {
        setStatus("pending");
        setAskAgain(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (status === "pending") {
    return (
      <div className="mt-6 text-center">
        <div className="text-4xl">⏳</div>
        <h2 className="mt-2 text-lg font-extrabold text-gray-900">Waiting for a coach</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your request has been sent. Once a coach approves it, this page opens the hub by itself —
          or come back to this link later.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-xl border border-gray-200 py-3 font-bold text-gray-700 hover:bg-gray-50"
        >
          Check Again
        </button>
      </div>
    );
  }

  if (status === "declined" && !askAgain) {
    return (
      <div className="mt-6 text-center">
        <h2 className="text-lg font-extrabold text-gray-900">Not approved</h2>
        <p className="mt-1 text-sm text-gray-500">A coach didn&apos;t approve this request. If that&apos;s a mistake, speak to your coach, then ask again.</p>
        <button onClick={() => setAskAgain(true)} className="mt-5 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700">
          Ask Again
        </button>
      </div>
    );
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <label>
        <span className="text-sm font-bold text-gray-800">Club code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="e.g. K7Q-M3X"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${input} font-mono uppercase tracking-widest`}
        />
        <span className="mt-1 block text-xs text-gray-400">Your coach can give you this.</span>
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" className={input} />
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Who you are</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
          placeholder="e.g. Sam's mum, U9s"
          className={input}
        />
        <span className="mt-1 block text-xs text-gray-400">So the coaches know who&apos;s asking.</span>
      </label>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Sending…" : "Ask to Join"}
      </button>
      <a href="/admin" className="text-center text-sm font-semibold text-gray-500 hover:text-green-700">
        I&apos;m a coach — sign in
      </a>
    </form>
  );
}
