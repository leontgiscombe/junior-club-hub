"use client";

// Sign a club up: its name, its web address (suggested from the name), its
// first team and the organiser's email. Then they sign in with the code we
// email them (they're the club's admin), and can add a passkey for next time.
import { useEffect, useState } from "react";
import { FORMAT_AGES, GAME_FORMATS } from "@/lib/clubSettings";
import SignInForm from "../../components/SignInForm";
import { addPasskey, cancelled, supportsPasskeys } from "../../components/passkey";

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
  const [team, setTeam] = useState("");
  // the first team's age group: which Training Hub its players see
  const [format, setFormat] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // after signing up: type the emailed code, then (maybe) add a passkey
  const [step, setStep] = useState<"code" | "passkey">("code");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

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
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: shownAddress, team, format, email, website, agreed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      // a sign-in code, so they can go straight in as the club's admin
      await fetch("/api/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setDone(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function passkeyThenGo() {
    setBusy(true);
    setPasskeyError(null);
    try {
      await addPasskey();
      window.location.href = done!;
    } catch (err) {
      if (!cancelled(err)) setPasskeyError(err instanceof Error ? err.message : "That didn't work");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-3 text-2xl font-extrabold text-gray-900">{name} is set up!</h2>
          <p className="mt-2 text-gray-500">
            Your hub is at <span className="font-bold text-gray-900">{shownAddress}.{rootDomain}</span>.
          </p>
        </div>
        {step === "code" ? (
          <div className="mt-5">
            <p className="mb-3 text-sm font-bold text-gray-800">Now sign in — you&apos;re the club&apos;s admin, no password needed.</p>
            <SignInForm sentTo={email} onSignedIn={() => (supportsPasskeys() ? setStep("passkey") : (window.location.href = done))} />
          </div>
        ) : (
          <div className="mt-5 text-center">
            <p className="text-sm text-gray-600">
              Next time, sign in with Face ID, your fingerprint or your phone&apos;s screen lock instead of waiting for a code. It also opens
              Financial Admin.
            </p>
            {passkeyError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{passkeyError}</p>}
            <button onClick={passkeyThenGo} disabled={busy} className="mt-4 w-full rounded-2xl bg-gray-900 py-3.5 font-bold text-white hover:bg-black disabled:opacity-50">
              Add a Passkey
            </button>
            <a href={done} className="mt-3 inline-block text-sm font-semibold text-gray-500 hover:text-gray-800">
              Not now — go to your hub →
            </a>
          </div>
        )}
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
        <span className="text-sm font-bold text-gray-800">Your team</span>
        <input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={30} className={input} placeholder="e.g. U10s Lions" />
        <span className="mt-1 block text-xs text-gray-400">Your club starts with this one team. Add more any time in Coach Admin → Settings.</span>
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Its age group</span>
        <select value={format} onChange={(e) => setFormat(e.target.value)} required className={input}>
          <option value="" disabled>
            Choose…
          </option>
          {GAME_FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_AGES[f]} · {f}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-400">
          The Training Hub gives the team&apos;s players the guide, quiz and challenges for their age. Change it any time in Settings.
        </span>
      </label>
      <label>
        <span className="text-sm font-bold text-gray-800">Your email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} placeholder="you@example.com" />
        <span className="mt-1 block text-xs text-gray-400">
          You sign in with it — no password. We&apos;ll email you a code next. Never shown to anyone.
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-600">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required className="mt-0.5 h-5 w-5 shrink-0 accent-green-600" />
        <span>
          I agree to the{" "}
          <a href="/terms" target="_blank" className="font-semibold text-green-700 underline">Terms of Use</a>{" "}
          for my club, and I&apos;ve read the{" "}
          <a href="/privacy" target="_blank" className="font-semibold text-green-700 underline">Privacy Policy</a>.
        </span>
      </label>
      {/* left empty by people; bots fill it in */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !!addressError || !agreed} className="mt-1 cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Setting up…" : "Create Your Club's Hub"}
      </button>
    </form>
  );
}
