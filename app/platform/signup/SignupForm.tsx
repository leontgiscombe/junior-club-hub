"use client";

// Sign a club up: its name, its web address (suggested from the name), the
// organiser's email and the coach password.
import { useEffect, useState } from "react";

const toAddress = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export default function SignupForm({ rootDomain }: { rootDomain: string }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const shownAddress = addressTouched ? address : toAddress(name);

  useEffect(() => {
    if (!shownAddress) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/signup?address=${encodeURIComponent(shownAddress)}`);
      const data = await res.json().catch(() => ({}));
      setAddressError(data.error ?? null);
    }, 300);
    return () => clearTimeout(t);
  }, [shownAddress]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: shownAddress, email, password, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setDone(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-3 text-2xl font-extrabold text-gray-900">{name} is set up!</h2>
        <p className="mt-2 text-gray-500">
          Your hub is at <span className="font-bold text-gray-900">{shownAddress}.{rootDomain}</span>.
          Sign in to Coach Admin with your coach password to add your badge, colours and teams.
        </p>
        <a href={done} className="mt-5 inline-block rounded-2xl bg-green-600 px-6 py-3.5 font-bold text-white hover:bg-green-700">
          Go to Your Hub →
        </a>
      </div>
    );
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label>
        <span className="text-sm font-bold text-gray-800">Club name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={input} placeholder="e.g. Riverside Rovers JFC" />
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Web address</span>
        <div className="mt-1 flex items-center rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-green-400">
          <input
            value={shownAddress}
            onChange={(e) => {
              setAddressTouched(true);
              setAddress(toAddress(e.target.value));
            }}
            required
            className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 text-gray-900 focus:outline-none"
            placeholder="riverside-rovers"
          />
          <span className="shrink-0 pr-3 text-sm text-gray-400">.{rootDomain}</span>
        </div>
        {addressError && shownAddress && <span className="mt-1 block text-xs text-red-600">{addressError}</span>}
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Your email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} placeholder="you@example.com" />
        <span className="mt-1 block text-xs text-gray-400">So we can reach you about your club. Never shown to anyone.</span>
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Coach password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" className={input} />
        <span className="mt-1 block text-xs text-gray-400">At least 8 characters. Your coaches use it to sign in to Coach Admin.</span>
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Coach password again</span>
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required autoComplete="new-password" className={input} />
      </label>
      {/* left empty by people; bots fill it in */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !!addressError} className="mt-1 cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Setting up…" : "Create Your Club's Hub"}
      </button>
    </form>
  );
}
