"use client";

// Setting up a game, one question at a time, for a coach:
//   1. Which team?            (skipped with one team, or when editing)
//   2. What is it?            home match, away match, tournament or training
//                             match — and who against (or the tournament's name)
//   3. When and where?        date, meet, kick-off, ground and address
//   4. Who's invited?         the whole squad or picked players, a reply-by
//                             time if wanted, and a note for the families
//   5. Check and send         to the families, or saved to send later
// Editing a game goes through the same steps, with what's saved filled in.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "@/lib/dialog";
import { haptic } from "@/lib/haptics";

export type WizardTeam = { slug: string; name: string; opponents: string[]; squad: { id: string; name: string }[] };
export type Venue = { team: string; venue: string; address: string; home: boolean };
export type GameType = "home" | "away" | "tournament" | "training";
export type WizardValues = {
  team: string;
  type: GameType;
  competition: "league" | "cup" | "friendly";
  opponent: string;
  date: string;
  time: string;
  meetTime: string;
  venue: string;
  address: string;
  notes: string;
  /** null: the whole squad */
  invited: string[] | null;
  /** "YYYY-MM-DDTHH:MM", or "" */
  deadline: string;
};

const field =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[16px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-[#2c2c2e] dark:text-gray-50";
const label = "mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200";

const TYPES: { id: GameType; title: string; body: string; icon: React.ReactNode }[] = [
  { id: "home", title: "Home match", body: "We're hosting", icon: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></> },
  { id: "away", title: "Away match", body: "We're travelling", icon: <><path d="M4 16h13l3-4-3-4H4z" /><path d="M8 20v-4" /></> },
  { id: "tournament", title: "Tournament", body: "Several games in a day", icon: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></> },
  { id: "training", title: "Training match", body: "A practice game", icon: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /></> },
];

/** "HH:MM" less `minutes`, for a suggested meet time. */
function before(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const t = (h * 60 + m - minutes + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const day = (date: string) =>
  date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }) : "";

export default function FixtureWizard({
  teams,
  venues,
  initial,
  matchId,
  sent,
  startAt,
}: {
  teams: WizardTeam[];
  venues: Venue[];
  initial: WizardValues;
  matchId?: string;
  sent?: boolean;
  /** open on this step (a game from FA Full-Time starts on "when") */
  startAt?: "when" | "who";
}) {
  const router = useRouter();
  const [v, setV] = useState<WizardValues>(initial);
  const steps = (["team", "type", "when", "who", "check"] as const).filter((s) => s !== "team" || (!matchId && teams.length > 1));
  const [step, setStep] = useState(() => Math.max(0, startAt ? steps.indexOf(startAt) : 0));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [tell, setTell] = useState(true);
  const set = <K extends keyof WizardValues>(k: K, value: WizardValues[K]) => setV((x) => ({ ...x, [k]: value }));

  const team = teams.find((t) => t.slug === v.team);
  const squad = team?.squad ?? [];
  const isMatch = v.type === "home" || v.type === "away";
  const opponents = isMatch && v.competition === "league" ? team?.opponents ?? [] : [];
  const now = steps[step];

  const known = useMemo(() => {
    const seen = new Map<string, Venue>();
    for (const x of [...venues.filter((x) => x.team === v.team && x.home === (v.type === "home")), ...venues]) {
      const k = x.venue.trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, x);
    }
    return [...seen.values()];
  }, [venues, v.team, v.type]);

  /** What's missing before moving on from a step, if anything. */
  function problem(s: (typeof steps)[number]): string {
    if (s === "team" && !v.team) return "Pick the team";
    if (s === "type" && !v.opponent.trim()) return v.type === "tournament" ? "What's the tournament called?" : "Who are you playing?";
    if (s === "when" && !v.date) return "Pick the date";
    if (s === "who" && v.invited && !v.invited.length) return "Pick at least one player, or invite the whole squad";
    return "";
  }
  function next() {
    const p = problem(now);
    if (p) return setError(p);
    setError("");
    setStep((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo(0, 0);
  }
  function back() {
    setError("");
    if (step === 0) return router.back();
    setStep((i) => i - 1);
    window.scrollTo(0, 0);
  }

  async function save(send: boolean) {
    for (const s of steps) {
      const p = problem(s);
      if (p) {
        setStep(steps.indexOf(s));
        return setError(p);
      }
    }
    setBusy(send ? "send" : "save");
    setError("");
    const values = { ...v, opponent: v.opponent.trim() };
    try {
      const res = await fetch("/api/fixtures", {
        method: matchId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          matchId
            ? { matchId, action: "edit", ...values, team: undefined, tell: !!sent && tell }
            : { ...values, send },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That didn't save — try again");
        setBusy("");
        return;
      }
      haptic();
      const told = Number(data.told ?? 0);
      toast(send || told ? `Sent${told ? ` to ${told} ${told === 1 ? "family" : "families"}` : ""}` : "Saved");
      router.replace(`/admin/fixtures/${matchId ?? data.match.id}`);
    } catch {
      setError("No connection — try again");
      setBusy("");
    }
  }

  const choice = (on: boolean) =>
    `press flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-2 ${
      on ? "bg-green-50 ring-green-600 dark:bg-green-400/10" : "bg-white ring-transparent shadow-sm dark:bg-[#1c1c1e]"
    }`;
  const pill = (on: boolean) => `press rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-green-700 text-white" : "bg-white text-gray-700 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-200"}`;
  const title = v.type === "tournament" ? v.opponent || "Tournament" : `${team?.name ?? ""} vs ${v.opponent || "…"}`;

  return (
    <div className="flex flex-col gap-5 pb-32">
      {/* where they are */}
      <div className="flex gap-1.5" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-green-600" : "bg-gray-200 dark:bg-white/10"}`} />
        ))}
      </div>

      {now === "team" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-extrabold">Which team?</h2>
          {teams.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => {
                setV((x) => ({ ...x, team: t.slug, invited: null, opponent: x.team === t.slug ? x.opponent : "" }));
                setError("");
                setStep(1);
              }}
              className={choice(v.team === t.slug)}
            >
              <span className="flex-1 text-[17px] font-bold">{t.name}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t.squad.length} players</span>
            </button>
          ))}
        </section>
      )}

      {now === "type" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-extrabold">What is it?</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setV((x) => ({ ...x, type: t.id, opponent: (x.type === "tournament") === (t.id === "tournament") ? x.opponent : "" }))}
                className={`press flex flex-col items-start gap-2 rounded-2xl p-4 text-left ring-2 ${
                  v.type === t.id ? "bg-green-50 ring-green-600 dark:bg-green-400/10" : "bg-white ring-transparent shadow-sm dark:bg-[#1c1c1e]"
                }`}
              >
                <svg viewBox="0 0 24 24" className={`h-7 w-7 ${v.type === t.id ? "text-green-700 dark:text-green-400" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {t.icon}
                </svg>
                <span className="font-bold">{t.title}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t.body}</span>
              </button>
            ))}
          </div>

          {isMatch && (
            <div className="mt-2">
              <span className={label}>Is it a…</span>
              <div className="flex flex-wrap gap-2">
                {(["league", "cup", "friendly"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => set("competition", c)} className={pill(v.competition === c)}>
                    {c === "league" ? "League game" : c === "cup" ? "Cup game" : "Friendly"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="mt-2 block">
            <span className={label}>{v.type === "tournament" ? "Tournament name" : "Who are you playing?"}</span>
            {opponents.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {opponents.map((o) => (
                  <button key={o} type="button" onClick={() => set("opponent", o)} className={pill(v.opponent === o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
            <input
              value={v.opponent}
              onChange={(e) => set("opponent", e.target.value)}
              placeholder={v.type === "tournament" ? "e.g. Pudsey Summer Cup" : opponents.length ? "Or type another team" : "e.g. Calverley United U10s"}
              className={field}
              autoComplete="off"
            />
          </label>
        </section>
      )}

      {now === "when" && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold">When and where?</h2>
          <label className="block">
            <span className={label}>Date</span>
            <input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>{v.type === "tournament" ? "Starts" : "Kick-off"}</span>
              <input
                type="time"
                value={v.time}
                onChange={(e) => {
                  const time = e.target.value;
                  // meet half an hour before, until they choose their own
                  setV((x) => ({ ...x, time, meetTime: x.meetTime && x.meetTime !== before(x.time, 30) ? x.meetTime : time ? before(time, 30) : "" }));
                }}
                className={field}
              />
            </label>
            <label className="block">
              <span className={label}>Meet at</span>
              <input type="time" value={v.meetTime} onChange={(e) => set("meetTime", e.target.value)} className={field} />
            </label>
          </div>
          <label className="block">
            <span className={label}>Ground</span>
            <input
              list="wizard-venues"
              value={v.venue}
              onChange={(e) => {
                const name = e.target.value;
                const hit = known.find((x) => x.venue.trim().toLowerCase() === name.trim().toLowerCase());
                setV((x) => ({ ...x, venue: name, address: hit && !x.address.trim() ? hit.address : x.address }));
              }}
              placeholder="e.g. Woodhall Sports Hub, pitch 1C"
              className={field}
              autoComplete="off"
            />
            <datalist id="wizard-venues">
              {known.map((x) => (
                <option key={x.venue} value={x.venue} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={label}>Address</span>
            <textarea value={v.address} onChange={(e) => set("address", e.target.value)} rows={2} placeholder="Street and postcode, for the map" className={field} />
          </label>
        </section>
      )}

      {now === "who" && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold">Who&apos;s invited?</h2>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => set("invited", null)} className={choice(v.invited === null)}>
              <span className="flex-1">
                <span className="block font-bold">The whole squad</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">{squad.length} players</span>
              </span>
            </button>
            <button type="button" onClick={() => set("invited", v.invited ?? [])} className={choice(v.invited !== null)}>
              <span className="flex-1">
                <span className="block font-bold">Choose players</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">{v.invited ? `${v.invited.length} picked` : "Only some of the squad"}</span>
              </span>
            </button>
          </div>
          {v.invited !== null && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#1c1c1e]">
              <div className="flex justify-between border-b border-gray-100 px-4 py-2.5 text-sm dark:border-white/10">
                <button type="button" onClick={() => set("invited", squad.map((p) => p.id))} className="font-semibold text-green-700 dark:text-green-400">
                  Select all
                </button>
                <button type="button" onClick={() => set("invited", [])} className="font-semibold text-gray-500 dark:text-gray-400">
                  Clear
                </button>
              </div>
              {squad.map((p) => {
                const on = v.invited!.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-white/10">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => set("invited", on ? v.invited!.filter((id) => id !== p.id) : [...v.invited!, p.id])}
                      className="h-5 w-5 accent-green-700"
                    />
                    <span className="text-[15px] font-semibold">{p.name}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div>
            <span className={label}>Reply by</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set("deadline", "")} className={pill(!v.deadline)}>
                No deadline
              </button>
              <button
                type="button"
                onClick={() => {
                  if (v.deadline) return;
                  // two days before, at 6pm
                  const base = v.date || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
                  const d = new Date(Date.parse(`${base}T12:00:00Z`) - (v.date ? 2 : 0) * 86_400_000).toISOString().slice(0, 10);
                  set("deadline", `${d}T18:00`);
                }}
                className={pill(!!v.deadline)}
              >
                Set a time
              </button>
            </div>
            {v.deadline !== "" && (
              <input type="datetime-local" value={v.deadline} onChange={(e) => set("deadline", e.target.value)} className={`${field} mt-2`} />
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">After this, families can&apos;t change their answer without asking you.</p>
          </div>

          <label className="block">
            <span className={label}>Message for families (optional)</span>
            <textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Kit, parking, what to bring…" className={field} />
          </label>
        </section>
      )}

      {now === "check" && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold">{matchId ? "Check and save" : "Check and send"}</h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
            {[
              ["Game", title],
              ["Type", `${TYPES.find((t) => t.id === v.type)?.title}${isMatch ? ` · ${v.competition === "league" ? "League" : v.competition === "cup" ? "Cup" : "Friendly"}` : ""}`],
              ["Date", day(v.date)],
              ["Meet", v.meetTime || "—"],
              [v.type === "tournament" ? "Starts" : "Kick-off", v.time || "—"],
              ["Where", [v.venue, v.address].filter(Boolean).join(", ") || "—"],
              ["Invited", v.invited ? `${v.invited.length} of ${squad.length} players` : `Whole squad (${squad.length})`],
              ["Reply by", v.deadline ? `${day(v.deadline.slice(0, 10))}, ${v.deadline.slice(11)}` : "No deadline"],
            ].map(([k, val], i) => (
              <button
                key={k}
                type="button"
                // tap a line to change it
                onClick={() => setStep(steps.indexOf(i === 0 || i === 1 ? "type" : i < 6 ? "when" : "who"))}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="w-20 shrink-0 text-sm text-gray-500 dark:text-gray-400">{k}</span>
                <span className="flex-1 text-[15px] font-semibold">{val}</span>
              </button>
            ))}
          </div>
          {v.notes.trim() && <p className="whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-[15px] shadow-sm dark:bg-[#1c1c1e]">{v.notes.trim()}</p>}
          {matchId && sent && (
            <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm dark:bg-[#1c1c1e]">
              <input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} className="h-5 w-5 accent-green-700" />
              <span className="text-[15px] font-semibold">Tell the families it&apos;s changed</span>
            </label>
          )}
        </section>
      )}

      {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      {/* Back and Next, held at the bottom of the screen */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-[#f2f2f7]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md dark:border-white/10 dark:bg-black/90">
        <div className="mx-auto flex max-w-xl gap-2">
          <button type="button" onClick={back} disabled={!!busy} className="press rounded-2xl bg-white px-5 py-3.5 font-bold text-gray-900 shadow-sm disabled:opacity-50 dark:bg-[#1c1c1e] dark:text-gray-50">
            Back
          </button>
          {now !== "check" ? (
            now !== "team" && (
              <button type="button" onClick={next} className="press flex-1 rounded-2xl bg-green-700 py-3.5 font-bold text-white">
                Next
              </button>
            )
          ) : matchId ? (
            <button type="button" onClick={() => save(false)} disabled={!!busy} className="press flex-1 rounded-2xl bg-green-700 py-3.5 font-bold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save changes"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => save(false)} disabled={!!busy} className="press rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-gray-900 shadow-sm disabled:opacity-50 dark:bg-[#1c1c1e] dark:text-gray-50">
                {busy === "save" ? "Saving…" : "Save for later"}
              </button>
              <button type="button" onClick={() => save(true)} disabled={!!busy} className="press flex-1 rounded-2xl bg-green-700 py-3.5 font-bold text-white disabled:opacity-50">
                {busy === "send" ? "Sending…" : "Send to families"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
