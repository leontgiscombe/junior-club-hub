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
import { KIT_COLOURS, Shirt, type KitColour } from "@/lib/kitColours";
import GroundSearch from "./GroundSearch";

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
  /** shirt colours (lib/kitColours.tsx), "" for not said */
  ourKit: string;
  theirKit: string;
  /** a new game repeating: every 1 or 2 weeks, so many times in all; every 0 for just once */
  repeat: { every: 0 | 1 | 2; times: number };
};
/** The colours a team last played in, at home and away, to start from. */
export type LastKits = Record<string, { home?: { ourKit: string; theirKit: string }; away?: { ourKit: string; theirKit: string } }>;

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
/** The meet times offered, in minutes before kick-off. */
const MEET_GAPS = [0, 15, 30, 45, 60, 75, 90, 120];

/** "At kick-off", "30 minutes before", "1 hour before", "1 hour 15 minutes before". */
function gapWords(m: number): string {
  if (m === 0) return "At kick-off";
  if (m < 0) return `${-m} minutes after`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hours = h ? `${h} hour${h === 1 ? "" : "s"}` : "";
  const mins = r ? `${r} minutes` : "";
  return `${[hours, mins].filter(Boolean).join(" ")} before`;
}

/** How many minutes `meet` is before `kickOff` (both "HH:MM"). */
function minutesBefore(kickOff: string, meet: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const gap = (m(kickOff) - m(meet) + 1440) % 1440;
  // a meet "after" kick-off reads as such, not as 23 hours before
  return gap > 720 ? gap - 1440 : gap;
}

function before(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const t = (h * 60 + m - minutes + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** The date of the last game in a repeat. */
const lastDate = (v: WizardValues) =>
  v.date ? new Date(Date.parse(`${v.date}T12:00:00Z`) + (v.repeat.times - 1) * 7 * v.repeat.every * 86_400_000).toISOString().slice(0, 10) : "";

const day = (date: string) =>
  date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }) : "";

export default function FixtureWizard({
  teams,
  venues,
  initial,
  matchId,
  sent,
  startAt,
  lastKits = {},
  inSeries = 0,
}: {
  teams: WizardTeam[];
  venues: Venue[];
  initial: WizardValues;
  matchId?: string;
  sent?: boolean;
  /** open on this step (a game from FA Full-Time starts on "when") */
  startAt?: "when" | "who";
  lastKits?: LastKits;
  /** editing a game with this many later games in its series */
  inSeries?: number;
}) {
  const router = useRouter();
  const [v, setV] = useState<WizardValues>(initial);
  const steps = (["team", "type", "when", "who", "check"] as const).filter((s) => s !== "team" || (!matchId && teams.length > 1));
  // straight past "Which team?" when it's already chosen (New game from a team's list)
  const [step, setStep] = useState(() => Math.max(0, startAt ? steps.indexOf(startAt) : initial.team ? steps.indexOf("type") : 0));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [tell, setTell] = useState(true);
  const [wholeSeries, setWholeSeries] = useState(false);
  // a new game starts in the colours the team last wore at home (or away), until a coach picks
  const [kitPicked, setKitPicked] = useState(!!matchId);
  const kitsFor = (x: WizardValues): WizardValues => {
    if (kitPicked) return x;
    const last = lastKits[x.team]?.[x.type === "away" ? "away" : "home"];
    return { ...x, ourKit: last?.ourKit ?? "", theirKit: last?.theirKit ?? "" };
  };
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
            ? { matchId, action: "edit", ...values, team: undefined, repeat: undefined, tell: !!sent && tell, series: wholeSeries }
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
      if (Number(data.games) > 1) toast(`${data.games} games ${send ? "sent" : "saved"}`);
      else toast(send || told ? `Sent${told ? ` to ${told} ${told === 1 ? "family" : "families"}` : ""}` : "Saved");
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
    <div className="fixture-wizard flex flex-col gap-5 pb-32">
      {/* a game half set up: pulling the page down mustn't reload it and lose what's typed (public/app-feel.js) */}
      <span hidden data-unsaved />
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
                setV((x) => kitsFor({ ...x, team: t.slug, invited: null, opponent: x.team === t.slug ? x.opponent : "" }));
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
                onClick={() => setV((x) => kitsFor({ ...x, type: t.id, opponent: (x.type === "tournament") === (t.id === "tournament") ? x.opponent : "" }))}
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

          {/* the shirts each side plays in, so families know what to wear and look for */}
          {[
            { k: "ourKit" as const, title: `Our kit${team ? ` (${team.name})` : ""}` },
            ...(v.type !== "tournament" ? [{ k: "theirKit" as const, title: "Their kit" }] : []),
          ].map(({ k, title: t }) => (
            <div key={k} className="mt-2">
              <span className={label}>
                {t} <span className="font-normal text-gray-500 dark:text-gray-400">· {v[k] ? KIT_COLOURS[v[k] as KitColour]?.label : "optional"}</span>
              </span>
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
                <button type="button" onClick={() => { setKitPicked(true); set(k, ""); }} aria-pressed={!v[k]} aria-label="Not said" className={`press grid h-11 w-11 shrink-0 place-items-center rounded-full ring-2 ${!v[k] ? "ring-green-600" : "ring-transparent"} bg-white shadow-sm dark:bg-[#1c1c1e]`}>
                  <Shirt colour="" className="h-6 w-6" />
                </button>
                {(Object.keys(KIT_COLOURS) as KitColour[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setKitPicked(true);
                      set(k, c);
                    }}
                    aria-pressed={v[k] === c}
                    aria-label={KIT_COLOURS[c].label}
                    className={`press grid h-11 w-11 shrink-0 place-items-center rounded-full ring-2 ${v[k] === c ? "ring-green-600" : "ring-transparent"} bg-white shadow-sm dark:bg-[#1c1c1e]`}
                  >
                    <Shirt colour={c} className="h-7 w-7" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {now === "when" && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold">When and where?</h2>
          <label className="block">
            <span className={label}>Date</span>
            <input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>{v.type === "tournament" ? "Starts" : "Kick-off"}</span>
            <input
              type="time"
              value={v.time}
              onChange={(e) => {
                const time = e.target.value;
                // the meet time keeps its distance from kick-off (half an hour, to start with)
                setV((x) => {
                  const gap = x.time && x.meetTime ? minutesBefore(x.time, x.meetTime) : 30;
                  return { ...x, time, meetTime: time ? before(time, gap) : x.meetTime };
                });
              }}
              className={field}
            />
          </label>
          <label className="block">
            <span className={label}>Meet</span>
            {(() => {
              const gap = v.time && v.meetTime ? minutesBefore(v.time, v.meetTime) : null;
              // a meet time that isn't one of the usual gaps (set before, or moved by FA Full-Time) stays as it is
              const custom = gap !== null && !MEET_GAPS.includes(gap);
              return (
                <select
                  value={!v.meetTime ? "none" : gap === null ? "none" : String(gap)}
                  disabled={!v.time}
                  onChange={(e) => set("meetTime", e.target.value === "none" ? "" : before(v.time, Number(e.target.value)))}
                  className={`${field} disabled:opacity-60`}
                >
                  {!v.time ? (
                    <option value="none">Set the {v.type === "tournament" ? "start" : "kick-off"} time first</option>
                  ) : (
                    <>
                      <option value="none">No meet time</option>
                      {MEET_GAPS.map((m) => (
                        <option key={m} value={m}>
                          {gapWords(m)} ({before(v.time, m)})
                        </option>
                      ))}
                      {custom && (
                        <option value={gap}>
                          {gapWords(gap)} ({v.meetTime})
                        </option>
                      )}
                    </>
                  )}
                </select>
              );
            })()}
          </label>
          <div>
            <span className={label}>Ground</span>
            <GroundSearch
              venue={v.venue}
              known={known}
              className={field}
              onType={(venue) => set("venue", venue)}
              onPick={(place) => setV((x) => ({ ...x, venue: place.venue, address: place.address }))}
            />
          </div>
          <label className="block">
            <span className={label}>Address</span>
            <textarea value={v.address} onChange={(e) => set("address", e.target.value)} rows={2} placeholder="Street and postcode, for the map" className={field} />
          </label>

          {/* the same game again each week or two, as separate games */}
          {!matchId && (
            <div>
              <span className={label}>Repeat</span>
              <div className="flex flex-wrap gap-2">
                {([0, 1, 2] as const).map((every) => (
                  <button key={every} type="button" onClick={() => set("repeat", { every, times: every ? Math.max(v.repeat.times, 4) : 1 })} className={pill(v.repeat.every === every)}>
                    {every === 0 ? "Just once" : every === 1 ? "Every week" : "Every 2 weeks"}
                  </button>
                ))}
              </div>
              {v.repeat.every > 0 && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-[#1c1c1e]">
                  <span className="flex-1 text-[15px] font-semibold">
                    {v.repeat.times} games
                    {v.date && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">Last one {day(lastDate(v))}</span>}
                  </span>
                  <button type="button" aria-label="One fewer" onClick={() => set("repeat", { ...v.repeat, times: Math.max(2, v.repeat.times - 1) })} className="press grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-xl font-bold dark:bg-white/10">
                    −
                  </button>
                  <button type="button" aria-label="One more" onClick={() => set("repeat", { ...v.repeat, times: Math.min(26, v.repeat.times + 1) })} className="press grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-xl font-bold dark:bg-white/10">
                    +
                  </button>
                </div>
              )}
            </div>
          )}
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
              ["Date", v.repeat.every && !matchId ? `${day(v.date)}, then ${v.repeat.every === 1 ? "every week" : "every 2 weeks"} (${v.repeat.times} games, to ${day(lastDate(v))})` : day(v.date)],
              ["Meet", v.meetTime ? `${v.meetTime}${v.time ? ` · ${gapWords(minutesBefore(v.time, v.meetTime)).toLowerCase()}` : ""}` : "—"],
              [v.type === "tournament" ? "Starts" : "Kick-off", v.time || "—"],
              ["Where", [v.venue, v.address].filter(Boolean).join(", ") || "—"],
              ["Kit", [v.ourKit && `Us: ${KIT_COLOURS[v.ourKit as KitColour]?.label}`, v.theirKit && v.type !== "tournament" && `Them: ${KIT_COLOURS[v.theirKit as KitColour]?.label}`].filter(Boolean).join(" · ") || "—"],
              ["Invited", v.invited ? `${v.invited.length} of ${squad.length} players` : `Whole squad (${squad.length})`],
              ["Reply by", v.deadline ? `${day(v.deadline.slice(0, 10))}, ${v.deadline.slice(11)}` : "No deadline"],
            ].map(([k, val], i) => (
              <button
                key={k}
                type="button"
                // tap a line to change it
                onClick={() => setStep(steps.indexOf(i <= 1 || i === 6 ? "type" : i < 6 ? "when" : "who"))}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="w-20 shrink-0 text-sm text-gray-500 dark:text-gray-400">{k}</span>
                <span className="flex-1 text-[15px] font-semibold">{val}</span>
              </button>
            ))}
          </div>
          {v.notes.trim() && <p className="whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-[15px] shadow-sm dark:bg-[#1c1c1e]">{v.notes.trim()}</p>}
          {matchId && inSeries > 0 && (
            <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm dark:bg-[#1c1c1e]">
              <input type="checkbox" checked={wholeSeries} onChange={(e) => setWholeSeries(e.target.checked)} className="h-5 w-5 accent-green-700" />
              <span className="text-[15px] font-semibold">
                Also change the {inSeries} later {inSeries === 1 ? "game" : "games"} in this series
                <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">Everything but the date: each keeps its own day</span>
              </span>
            </label>
          )}
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
