"use client";

// Ask to join: first the club's code; once it's right, sign in (or make an
// account) with your email; then a step at a time, your name, who you are, your
// team and (for a parent, or a coach who has a child at the club too) your
// child's name, your mobile and anything else. Then
// you wait for a coach to approve you — this page checks every so often by itself. The team list only shows once the code
// is right, and nobody sees the club's players here.
import { useEffect, useState } from "react";
import { RELATIONS, type Relation } from "@/lib/access";
import ChildrenEditor, { type ChildDraft } from "../components/ChildrenEditor";
import NameFields from "../components/NameFields";
import SignInForm from "../components/SignInForm";

type Status = "none" | "pending" | "approved" | "declined";
type TeamOption = { slug: string; name: string };
type Step = "name" | "who" | "team" | "kids" | "phone" | "note";

export default function JoinForm({
  initialStatus,
  initialCode,
  account,
}: {
  initialStatus: Status;
  initialCode: string;
  account: { email: string; name: string } | null;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [code, setCode] = useState(initialCode);
  const [signedIn, setSignedIn] = useState(!!account);
  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [relation, setRelation] = useState<Relation | "">("");
  const [team, setTeam] = useState("");
  const [children, setChildren] = useState<ChildDraft[]>([{ name: "", team: "" }]);
  // a coach, volunteer or anyone else who's also a parent here
  const [alsoParent, setAlsoParent] = useState(false);
  // the teams, once the code has been checked
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askAgain, setAskAgain] = useState(false);
  const [step, setStep] = useState<Step>("name");

  // a code from the join link (or an open hub's own): checked straight away
  useEffect(() => {
    if (initialCode && initialStatus === "none") document.getElementById("join-code-next")?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

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

  const withKids = relation === "parent" || (alsoParent && relation !== "" && relation !== "player");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          teams
            ? { code, name, phone, relation, team, children: withKids ? children.filter((c) => c.name.trim()) : [], note }
            : { code },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (data.status === "ok") {
        setTeams(data.teams);
        if (data.teams.length === 1) {
          setTeam(data.teams[0].slug);
          setChildren([{ name: "", team: data.teams[0].slug }]);
        }
      } else {
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
        <h2 className="mt-2 text-lg font-extrabold text-gray-900 dark:text-gray-50">Waiting for a coach</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your request has been sent. Once a coach approves it, this page opens the hub by itself —
          or come back to this link later.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-xl border border-gray-200 py-3 font-bold text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15"
        >
          Check Again
        </button>
        <div className="mt-4">
          <SwitchAccount email={account?.email} />
        </div>
      </div>
    );
  }

  if (status === "declined" && !askAgain) {
    return (
      <div className="mt-6 text-center">
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-50">Not approved</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A coach didn&apos;t approve this request. If that&apos;s a mistake, speak to your coach, then ask again.</p>
        <button onClick={() => setAskAgain(true)} className="mt-5 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700">
          Ask Again
        </button>
      </div>
    );
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";
  if (!teams) {
    return (
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Club code</span>
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
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
        <button id="join-code-next" disabled={busy || !code.trim()} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
          {busy ? "Checking…" : "Next"}
        </button>
        {account ? (
          <SwitchAccount email={account.email} />
        ) : (
          <a href="/signin?next=/" className="text-center text-sm font-semibold text-green-700 hover:text-green-800 dark:text-green-400">
            Already a member? Sign in
          </a>
        )}
        <p className="flex justify-center gap-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
          <a href="/admin" className="hover:text-green-700">Coach Sign In</a>
          <a href="/player" className="hover:text-green-700">I&apos;m a Player</a>
        </p>
      </form>
    );
  }

  if (!signedIn) {
    return (
      <div className="mt-6">
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-300">
          That&apos;s the right code. Now sign in with your own email — it makes your account, if you
          haven&apos;t one, so you can open the hub on any device. Use your personal email rather than a
          shared one: one account covers everything, whether you&apos;re a parent, a coach or both.
        </p>
        <SignInForm
          next={`/join?code=${encodeURIComponent(code)}`}
          onSignedIn={async () => {
            // the account's name, if it has one already
            const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
            if (me?.user?.name) setName(me.user.name);
            if (me?.person?.status === "approved") window.location.href = "/";
            else if (me?.person?.status === "pending") setStatus("pending");
            setSignedIn(true);
          }}
        />
      </div>
    );
  }

  // the rest a step at a time, each its own form: Next (or Enter) once it's filled in
  // (until they say who they are, counted as a parent's: the most who join)
  const who = relation || "parent";
  const order: Step[] = ["name", "who", ...(who === "parent" ? (["kids"] as const) : (["team"] as const)), ...(who !== "parent" && withKids ? (["kids"] as const) : []), "phone", "note"];
  const at = Math.max(order.indexOf(step), 0);
  const last = at === order.length - 1;
  const label = "text-sm font-bold text-gray-800 dark:text-gray-100";
  const heading = "text-xl font-extrabold text-gray-900 dark:text-gray-50";
  const hint = "mt-1 block text-xs text-gray-400";
  const kidsHint = "Their full name and team, for the club's squad. Only the club's coaches and members see them.";
  let body: React.ReactNode;
  if (step === "name") {
    body = (
      <>
        <h2 className={heading}>What&apos;s your name?</h2>
        <div>
          <NameFields value={name} onChange={setName} label="Your" required autoComplete className={input} />
        </div>
      </>
    );
  } else if (step === "who") {
    body = (
      <>
        <h2 className={heading}>You are a…</h2>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="You are a">
          {(Object.keys(RELATIONS) as Relation[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={relation === r}
              onClick={() => {
                setRelation(r);
                // straight on to the next step: a tap is the answer
                setStep(r === "parent" ? "kids" : "team");
              }}
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left font-bold ${
                relation === r
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300"
                  : "border-gray-200 text-gray-900 hover:bg-gray-50 dark:border-white/15 dark:text-gray-50 dark:hover:bg-white/5"
              }`}
            >
              {RELATIONS[r]}
              <span aria-hidden className="text-gray-400">›</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (step === "team") {
    body = (
      <>
        <h2 className={heading}>Your team</h2>
        {teams.length > 0 && (
          <label>
            <span className={label}>Team</span>
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={input}>
              <option value="">Not sure / more than one</option>
              {teams.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {relation !== "player" && (
          <label className="flex items-center gap-3 text-sm font-bold text-gray-800 dark:text-gray-100">
            <input type="checkbox" checked={alsoParent} onChange={(e) => setAlsoParent(e.target.checked)} className="h-5 w-5 accent-green-600" />
            I have a child who plays at the club
          </label>
        )}
      </>
    );
  } else if (step === "kids") {
    body = (
      <>
        <div>
          <h2 className={heading}>Your child (or children)</h2>
          <span className={hint}>{kidsHint}</span>
        </div>
        <ChildrenEditor value={children} teams={teams} onChange={setChildren} required />
      </>
    );
  } else if (step === "phone") {
    body = (
      <>
        <h2 className={heading}>Your mobile number</h2>
        <label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
            autoComplete="tel"
            inputMode="tel"
            maxLength={24}
            placeholder="e.g. 07700 900123"
            aria-label="Mobile number"
            className={input}
          />
          <span className={hint}>
            {withKids
              ? "So the club can reach you, and the team's treasurer can send a WhatsApp reminder about subs. Only the club's coaches and treasurer see it."
              : "So the club can reach you. Only the club's coaches and treasurer see it."}
          </span>
        </label>
      </>
    );
  } else {
    body = (
      <>
        <h2 className={heading}>Anything else?</h2>
        <label>
          <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus maxLength={120} placeholder="e.g. new this season" aria-label="Anything else" className={input} />
          <span className={hint}>Optional — anything the coaches should know.</span>
        </label>
      </>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        if (last) return submit(e);
        e.preventDefault();
        setError(null);
        setStep(order[at + 1]);
      }}
      className="mt-6 flex flex-col gap-4"
    >
      {/* where they are: a bar for each step, the done ones green */}
      <div>
        <div className="flex gap-1.5" aria-hidden>
          {order.map((o, i) => (
            <span key={o} className={`h-1.5 flex-1 rounded-full ${i <= at ? "bg-green-600" : "bg-gray-200 dark:bg-white/15"}`} />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          Step {at + 1} of {order.length}
          {account ? ` · ${account.email}` : ""}
        </p>
      </div>
      {body}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
      {/* "You are a…" moves on when one is tapped */}
      {step !== "who" && (
        <button disabled={busy} className="rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
          {last ? (busy ? "Sending…" : "Ask to Join") : "Next"}
        </button>
      )}
      {at > 0 && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep(order[at - 1]);
          }}
          disabled={busy}
          className="-mt-1 cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400"
        >
          ← Back
        </button>
      )}
    </form>
  );
}

/** Who's signed in, and a way to sign in as someone else instead (signed in, but not as a member here). */
function SwitchAccount({ email }: { email?: string }) {
  return (
    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
      {email ? <>Signed in as {email}. </> : null}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
          window.location.href = "/signin?next=/";
        }}
        className="font-semibold text-green-700 hover:text-green-800 dark:text-green-400"
      >
        Use another email
      </button>
    </p>
  );
}
