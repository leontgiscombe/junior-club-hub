"use client";

// Sign a club up, a step at a time: its name and web address; its crest and
// kit picture (both optional, Skip); then each team
// — its name and age group, its formation (when the age group has more than
// one), its training days and its FA Full-Time code (optional) — as many as
// the club has, with the plan that covers them after the free trial; which of
// them the organiser coaches; and the organiser's email. Nothing is saved
// until Create, so leaving part-way leaves nothing behind. Then they sign in
// with the code we email them (they're the club's admin, with their team),
// and can add a passkey for next time.
import { useEffect, useState } from "react";
import { DEFAULT_TRAINING, FORMATIONS, TEAM_AGES, ageFormat, ageName, kitAspect, type GameFormat, type TrainingSlot } from "@/lib/clubSettings";
import { PLANS, planForTeams, teamsLabel } from "@/lib/billing";
import SignInForm from "../../components/SignInForm";
import TrainingDays from "../../components/TrainingDays";
import FaCodeHelp from "../../components/FaCodeHelp";
import { BackgroundChoice, PICTURES, preparePicture, type Picture, type PictureSlot } from "../../components/clubPictures";
import { addPasskey, cancelled, supportsPasskeys } from "../../components/passkey";
import { looksShared } from "@/lib/sharedEmail";

const toAddress = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

// format follows from the age group (ageFormat), set with it
type Draft = { name: string; age: number; format: GameFormat | ""; formation: string; training: TrainingSlot[]; faSnippet: string };
const newTeam = (): Draft => ({ name: "", age: 0, format: "", formation: "", training: DEFAULT_TRAINING, faSnippet: "" });

type Step = "club" | "crest" | "kit" | "team" | "formation" | "training" | "fa" | "more" | "mine" | "you";
// the four parts the progress bar shows
const PARTS = ["Your club", "Crest & kit", "Teams", "Your team", "Your email"];
const partOf = (s: Step) => (s === "club" ? 0 : s === "crest" || s === "kit" ? 1 : s === "mine" ? 3 : s === "you" ? 4 : 2);

export default function SignupForm({ rootDomain, appView = false }: { rootDomain: string; appView?: boolean }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Draft[]>([]);
  // the team being filled in
  const [cur, setCur] = useState(0);
  // which team the organiser coaches (by its place in teams), or -1 for none
  const [mine, setMine] = useState(-1);
  // the crest and kit picture, made ready here and sent with the rest
  const [pictures, setPictures] = useState<Partial<Record<PictureSlot, Picture>>>({});
  // one with a plain background: both versions, to choose from
  const [pick, setPick] = useState<{ slot: PictureSlot; original: Picture; cleaned: Picture } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // where they are, and the steps behind them for Back
  const [step, setStep] = useState<Step>("club");
  const [history, setHistory] = useState<Step[]>([]);
  // after signing up: type the emailed code, then (maybe) add a passkey
  const [after, setAfter] = useState<"code" | "passkey">("code");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const shownAddress = addressTouched ? address : toAddress(name);
  const team = teams[cur];
  const shapes = team?.format ? FORMATIONS[team.format] : [];
  const plan = planForTeams(teams.length);

  useEffect(() => {
    if (!shownAddress) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/signup?address=${encodeURIComponent(shownAddress)}`);
      const data = await res.json().catch(() => ({}));
      setAddressError(data.error ?? null);
    }, 300);
    return () => clearTimeout(t);
  }, [shownAddress]);

  const go = (to: Step) => {
    setError(null);
    setHistory((h) => [...h, step]);
    setStep(to);
    window.scrollTo(0, 0);
  };
  const back = () => {
    setError(null);
    // a team just started and left empty goes when you step back from it
    if (step === "team" && team && !team.name.trim() && !team.format && teams.length > 1) {
      setTeams((all) => all.filter((_, i) => i !== cur));
      setCur(0);
    }
    setStep(history[history.length - 1] ?? "club");
    setHistory((h) => h.slice(0, -1));
  };
  const change = (patch: Partial<Draft>) => setTeams((all) => all.map((t, i) => (i === cur ? { ...t, ...patch } : t)));
  const startTeam = () => {
    setTeams((all) => [...all, newTeam()]);
    setCur(teams.length);
    go("team");
  };

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: shownAddress,
          teams: teams.map((t) => ({
            name: t.name.trim(),
            ...(t.age ? { age: t.age } : {}),
            ...(t.formation ? { formation: t.formation } : {}),
            training: t.training,
            ...(t.faSnippet ? { faSnippet: t.faSnippet } : {}),
          })),
          ...(mine >= 0 ? { myTeam: mine } : {}),
          ...pictures,
          email,
          website,
          agreed,
        }),
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
        {after === "code" ? (
          <div className="mt-5">
            <p className="mb-3 text-sm font-bold text-gray-800">Now sign in — you&apos;re the club&apos;s admin, no password needed.</p>
            <SignInForm sentTo={email} onSignedIn={() => (supportsPasskeys() ? setAfter("passkey") : (window.location.href = done))} />
          </div>
        ) : (
          <div className="mt-5 text-center">
            <p className="text-sm text-gray-600">
              Next time, sign in with Face ID, your fingerprint or your phone&apos;s screen lock instead of waiting for a code. It also opens
              Finances.
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
  const heading = "text-lg font-extrabold text-gray-900";
  const hint = "mt-1 block text-xs text-gray-400";
  const primary = "w-full cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50";
  // a choice as a big tappable row: age groups and formations
  const choice = (on: boolean) =>
    `w-full cursor-pointer rounded-xl border px-4 py-3 text-left font-semibold ${on ? "border-green-600 bg-green-50 text-green-900 ring-1 ring-green-600" : "border-gray-200 text-gray-800 hover:bg-gray-50"}`;
  const teamName = team?.name.trim() || "this team";

  // each step is its own form: Enter (or Next) moves on once it's filled in
  let body: React.ReactNode;
  let next: (() => void) | null = null;
  let nextLabel = "Next";
  let canNext = true;

  // on to the teams: back to one left half-filled, else the list (or the first one)
  const toTeams = () => {
    const unfinished = teams.findIndex((t) => !t.name.trim() || !t.format);
    if (unfinished >= 0) {
      setCur(unfinished);
      go("team");
    } else if (teams.length) go("more");
    else startTeam();
  };
  // a picture chosen: made ready, or (a plain background) both versions offered
  const choosePicture = async (slot: PictureSlot, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const made = await preparePicture(slot, file);
      if ("cleaned" in made) setPick({ slot, ...made });
      else {
        setPick(null);
        setPictures((p) => ({ ...p, [slot]: made.picture }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `That ${PICTURES[slot].name} didn't work — try another`);
    } finally {
      setPreparing(false);
    }
  };
  // the crest and kit steps: a preview, Upload (or Change), and Remove
  const pictureStep = (slot: PictureSlot) => {
    const chosen = pictures[slot];
    const kit = slot === "kit";
    return (
      <>
        <h2 className={heading}>{kit ? "Your kit" : "Your club crest"}</h2>
        <p className="-mt-2 text-sm text-gray-500">
          {kit
            ? "A picture of the new kit, shown on the Kit Sizes page so parents can see what they're choosing sizes for. A wide picture works best."
            : "Shown across your hub, on posters, and as the app's icon for your club. A square picture works best."}
        </p>
        {/* on the dark colour it's shown on */}
        <div
          className={`grid place-items-center rounded-2xl p-3 ${kit ? "bg-[#0b2412]" : "mx-auto aspect-square w-40 bg-[radial-gradient(circle_at_50%_46%,#1f5c2c_0%,#0b2412_55%,#060906_100%)]"}`}
          style={kit ? { aspectRatio: chosen ? kitAspect(chosen) : 16 / 9 } : undefined}
        >
          {chosen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={chosen.image} alt={kit ? "Your kit" : "Your crest"} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm font-semibold text-white/60">{kit ? "No kit picture yet" : "No crest yet"}</span>
          )}
        </div>
        {pick?.slot === slot ? (
          <BackgroundChoice
            what={PICTURES[slot].name}
            pick={pick}
            wide={kit}
            busy={preparing}
            onPick={(picture) => {
              setPictures((p) => ({ ...p, [slot]: picture }));
              setPick(null);
            }}
            onCancel={() => setPick(null)}
          />
        ) : (
          <div className="flex items-center justify-center gap-5">
            <label className="cursor-pointer rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50">
              {preparing ? "Getting it ready…" : chosen ? `Change ${kit ? "Picture" : "Crest"}` : `Upload ${kit ? "Kit Picture" : "Crest"}`}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={preparing}
                onChange={(e) => {
                  choosePicture(slot, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {chosen && (
              <button
                type="button"
                onClick={() => setPictures((p) => ({ ...p, [slot]: undefined }))}
                className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
        )}
        <span className={hint}>Optional: you can add or change it any time in Settings.</span>
      </>
    );
  };

  if (step === "club") {
    canNext = !!name.trim() && !!shownAddress && !addressError;
    next = () => go("crest");
    body = (
      <>
        <h2 className={heading}>Your club</h2>
        <label>
          <span className="text-sm font-bold text-gray-800">Club name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus className={input} placeholder="e.g. Riverside Rovers JFC" />
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
      </>
    );
  } else if (step === "crest" || step === "kit") {
    canNext = !preparing && pick?.slot !== step;
    next = step === "crest" ? () => go("kit") : toTeams;
    nextLabel = pictures[step] ? "Next" : "Skip";
    body = pictureStep(step);
  } else if (step === "team" && team) {
    canNext = !!team.name.trim() && !!team.format;
    next = () => go(shapes.length > 1 ? "formation" : "training");
    body = (
      <>
        <h2 className={heading}>{teams.length > 1 ? `Team ${cur + 1}` : "Your first team"}</h2>
        <label>
          <span className="text-sm font-bold text-gray-800">Team name</span>
          <input value={team.name} onChange={(e) => change({ name: e.target.value })} maxLength={30} autoFocus className={input} placeholder="e.g. U10s Lions" />
        </label>
        <div>
          <span className="text-sm font-bold text-gray-800">Age group</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {TEAM_AGES.map((age) => {
              const format = ageFormat(age);
              return (
                <button
                  key={age}
                  type="button"
                  onClick={() => change({ age, format, formation: FORMATIONS[format].includes(team.formation) ? team.formation : "" })}
                  className={choice(team.age === age).replace("text-left", "text-center")}
                >
                  U{age}
                  <span className="block text-xs font-normal text-gray-500">{format}</span>
                </button>
              );
            })}
          </div>
          <span className={hint}>Each age plays its own format (shown under it). The Training Hub gives the team&apos;s players the guide, quiz and challenges for it.</span>
        </div>
      </>
    );
  } else if (step === "formation" && team) {
    next = () => go("training");
    const picked = team.formation || shapes[0];
    body = (
      <>
        <h2 className={heading}>How does {teamName} line up?</h2>
        <div className="flex flex-col gap-2">
          {shapes.map((f, i) => (
            <button key={f} type="button" onClick={() => change({ formation: i === 0 ? "" : f })} className={choice(picked === f)}>
              {f}
              {i === 0 && <span className="font-normal text-gray-500"> · the usual {team.format}</span>}
            </button>
          ))}
        </div>
        <span className={hint}>The Training Hub teaches the team&apos;s players this shape: its positions, tactical guide and quiz. Players can&apos;t change it.</span>
      </>
    );
  } else if (step === "training" && team) {
    next = () => go("fa");
    body = (
      <>
        <h2 className={heading}>When does {teamName} train?</h2>
        <TrainingDays training={team.training} onChange={(training) => change({ training })} input={input} />
      </>
    );
  } else if (step === "fa" && team) {
    next = () => go("more");
    nextLabel = team.faSnippet ? "Next" : "Skip";
    body = (
      <>
        <h2 className={heading}>FA Full-Time code for {teamName}</h2>
        <div>
          <label>
            <span className="text-sm font-bold text-gray-800">Code (optional)</span>
            <input
              value={team.faSnippet}
              inputMode="numeric"
              maxLength={15}
              placeholder="e.g. 460765991"
              onChange={(e) => change({ faSnippet: e.target.value.replace(/\D/g, "") })}
              className={input}
            />
          </label>
          <FaCodeHelp after="You can add it later in Settings." />
        </div>
      </>
    );
  } else if (step === "more") {
    next = () => {
      // a club with one team: that's most likely the organiser's
      if (mine < 0 && teams.length === 1) setMine(0);
      go("mine");
    };
    body = (
      <>
        <h2 className={heading}>Your teams</h2>
        <div className="flex flex-col gap-2">
          {teams.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCur(i);
                go("team");
              }}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-gray-900">{t.name.trim()}</span>
                <span className="block text-xs text-gray-500">
                  {t.age ? ageName(t.age) : ""} · {t.format} · {t.formation || (t.format ? FORMATIONS[t.format][0] : "")}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-green-700">Edit</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={startTeam}
          disabled={teams.length >= 30}
          className="w-full cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-bold text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-50"
        >
          + Add Another Team
        </button>
        <p className="text-center text-xs text-gray-500">
          {teams.length} {teams.length === 1 ? "team" : "teams"}: the {PLANS[plan].name} plan ({teamsLabel(plan).toLowerCase()}) after your free trial. You can
          add more later in Settings.
        </p>
      </>
    );
  } else if (step === "mine") {
    next = () => go("you");
    body = (
      <>
        <h2 className={heading}>Which team do you coach?</h2>
        <div className="flex flex-col gap-2">
          {teams.map((t, i) => (
            <button key={i} type="button" onClick={() => setMine(i)} className={choice(mine === i)}>
              {t.name.trim()}
            </button>
          ))}
          <button type="button" onClick={() => setMine(-1)} className={choice(mine === -1)}>
            None, or more than one
          </button>
        </div>
        <span className={hint}>Your Training Hub and your alerts follow this team. You can change it later in Your Account.</span>
      </>
    );
  } else if (step === "you") {
    canNext = !!email.trim() && agreed && !busy;
    next = submit;
    nextLabel = busy ? "Setting up…" : "Create Your Club's Hub";
    body = (
      <>
        <h2 className={heading}>Your email</h2>
        <label>
          <span className="text-sm font-bold text-gray-800">Your own email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className={input} placeholder="you@example.com" />
          <span className="mt-1 block text-xs text-gray-500">
            This is your own account, and you&apos;ll be the club&apos;s admin. Use your personal email, not a shared club one: the same account works if
            you&apos;re also a coach or a parent, and other committee members can be made admins later with their own emails. No password: we&apos;ll email
            you a code.
          </span>
          {/* a shared address works, but tangles things later: say so, gently */}
          {looksShared(email, name) && (
            <span className="mt-2 block rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              That looks like a shared club address. It&apos;s best to sign up with your own email: then the account stays yours, and handing the club on is
              just making someone else an admin. If only you use this one, it&apos;s fine to carry on.
            </span>
          )}
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
      </>
    );
  }

  const part = partOf(step);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canNext && next) next();
      }}
      className="flex flex-col gap-4"
    >
      {/* where they are: four parts, the current one named */}
      <div>
        <div className="flex gap-1.5" aria-hidden>
          {PARTS.map((p, i) => (
            <span key={p} className={`h-1.5 flex-1 rounded-full ${i <= part ? "bg-green-600" : "bg-gray-200"}`} />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-gray-500">
          Step {part + 1} of {PARTS.length}: {PARTS[part]}
        </p>
      </div>
      {body}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={!canNext} className={primary}>
        {nextLabel}
      </button>
      {step !== "club" && (
        <button type="button" onClick={back} disabled={busy} className="-mt-1 cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-800">
          ← Back
        </button>
      )}
      {step === "club" && (
        // in the App Store app the plans and their prices come from the App Store, later on
        <p className="text-center text-sm text-gray-500">
          {appView ? "30 days free, with everything included — no card needed." : "30 days free, no card needed. Then from £4.99 a month, by how many teams you have."}
        </p>
      )}
    </form>
  );
}
