"use client";

// The parts of a fixture's page you press: answering whether a child can play
// (or a coach can host), the coaches' buttons, the result, and the line-up.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ask, askText, toast } from "@/lib/dialog";
import { haptic } from "@/lib/haptics";

type Answer = "yes" | "no" | null;

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) toast(String(data.error ?? "That didn't save — try again"), "error");
    return { ok: res.ok, data };
  } catch {
    toast("No connection — try again", "error");
    return { ok: false, data: {} };
  }
}

/**
 * Two halves of one pill — a tick and a cross — for whether someone's in.
 * Pressing the one already chosen takes the answer back.
 */
export function ReplyToggle({
  matchId,
  playerId,
  host,
  initial,
  initialNote = "",
  labels = ["Playing", "Can't play"],
  compact = false,
  wide = false,
}: {
  matchId: string;
  playerId?: string;
  host?: boolean;
  initial: Answer;
  initialNote?: string;
  labels?: [string, string];
  compact?: boolean;
  /** across the whole row, each half the same width */
  wide?: boolean;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer>(initial);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);

  async function choose(next: "yes" | "no") {
    if (busy) return;
    const value: Answer = answer === next ? null : next;
    let why = "";
    // a reason for the coaches, if they want to give one (a parent's own answer only)
    if (value === "no" && !host && !compact) {
      const typed = await askText("Can't make it? Add a reason for the coaches if you like (optional).", note);
      if (typed === null) return;
      why = typed.trim();
    }
    setBusy(true);
    const before = answer;
    setAnswer(value);
    const { ok } = await send("/api/fixtures/respond", "POST", { matchId, ...(host ? { host: true } : { playerId }), answer: value, note: why });
    setBusy(false);
    if (!ok) return setAnswer(before);
    setNote(why);
    haptic();
    router.refresh();
  }

  const size = compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm";
  const icon = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className={wide ? "w-full" : "shrink-0"}>
      <div className={`${wide ? "grid w-full grid-cols-2 [&>button]:justify-center" : "inline-flex"} overflow-hidden rounded-full ring-1 ring-gray-200 dark:ring-white/15`} role="group" aria-label={host ? "Can you host?" : "Can they play?"}>
        <button
          type="button"
          onClick={() => choose("yes")}
          aria-pressed={answer === "yes"}
          disabled={busy}
          className={`press flex items-center gap-1.5 font-bold ${size} ${
            answer === "yes" ? "bg-green-600 text-white" : "bg-white text-gray-700 dark:bg-[#2c2c2e] dark:text-gray-200"
          }`}
        >
          <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          {!compact && labels[0]}
          {compact && <span className="sr-only">{labels[0]}</span>}
        </button>
        <button
          type="button"
          onClick={() => choose("no")}
          aria-pressed={answer === "no"}
          disabled={busy}
          className={`press flex items-center gap-1.5 border-l border-gray-200 font-bold dark:border-white/15 ${size} ${
            answer === "no" ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900" : "bg-white text-gray-700 dark:bg-[#2c2c2e] dark:text-gray-200"
          }`}
        >
          <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
          {!compact && labels[1]}
          {compact && <span className="sr-only">{labels[1]}</span>}
        </button>
      </div>
      {!compact && answer === "no" && note && <p className="mt-1.5 max-w-[16rem] text-xs text-gray-500 dark:text-gray-400">“{note}”</p>}
    </div>
  );
}

/** The coaches' buttons: send it to the families, remind them, call it off, remove it. */
export function CoachActions({
  matchId,
  sent,
  waitingFamilies,
  calledOff,
  canCallOff,
}: {
  matchId: string;
  sent: boolean;
  waitingFamilies: number;
  calledOff: "" | "postponed" | "cancelled";
  canCallOff: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}, done?: (d: Record<string, unknown>) => void) {
    setBusy(action);
    const { ok, data } = await send("/api/fixtures", "PATCH", { matchId, action, ...extra });
    setBusy("");
    if (!ok) return;
    haptic();
    done?.(data);
    router.refresh();
  }
  const told = (d: Record<string, unknown>) => {
    const n = Number(d.told ?? 0);
    toast(n ? `Sent to ${n} ${n === 1 ? "family" : "families"}` : "Saved — no families with phone alerts to tell yet");
  };

  async function remove() {
    if (!(await ask("Remove this game?\n\nIts answers, line-up and anything logged against it in the Match Log go too.", { ok: "Remove", danger: true }))) return;
    setBusy("delete");
    const { ok } = await send(`/api/fixtures?id=${encodeURIComponent(matchId)}`, "DELETE");
    setBusy("");
    if (ok) {
      toast("Removed");
      router.replace("/fixtures");
    }
  }

  const button = "press flex-1 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-50";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!sent ? (
          <button
            type="button"
            disabled={!!busy || !!calledOff}
            onClick={() => act("send", {}, told)}
            className={`${button} bg-green-700 text-white`}
          >
            {busy === "send" ? "Sending…" : "Send to families"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!!busy || !waitingFamilies || !!calledOff}
            onClick={() => act("remind", {}, told)}
            className={`${button} bg-green-700 text-white`}
          >
            {busy === "remind" ? "Sending…" : waitingFamilies ? `Remind ${waitingFamilies} ${waitingFamilies === 1 ? "family" : "families"}` : "Everyone's replied"}
          </button>
        )}
        <Link href={`/fixtures/${matchId}/edit`} className={`${button} bg-white text-center text-gray-900 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-50`}>
          Edit details
        </Link>
      </div>
      <div className="flex gap-2">
        {calledOff ? (
          <button type="button" disabled={!!busy} onClick={() => act("call-off", { calledOff: "" })} className={`${button} bg-white text-green-700 shadow-sm dark:bg-[#1c1c1e] dark:text-green-400`}>
            It&apos;s back on
          </button>
        ) : (
          canCallOff && (
            <>
              <button type="button" disabled={!!busy} onClick={() => act("call-off", { calledOff: "postponed" })} className={`${button} bg-white text-amber-700 shadow-sm dark:bg-[#1c1c1e] dark:text-amber-400`}>
                Postpone
              </button>
              <button type="button" disabled={!!busy} onClick={() => act("call-off", { calledOff: "cancelled" })} className={`${button} bg-white text-amber-700 shadow-sm dark:bg-[#1c1c1e] dark:text-amber-400`}>
                Cancel
              </button>
            </>
          )
        )}
        <button type="button" disabled={!!busy} onClick={remove} className={`${button} bg-white text-red-600 shadow-sm dark:bg-[#1c1c1e] dark:text-red-400`}>
          Remove
        </button>
      </div>
    </div>
  );
}

/** The score, put in by a coach: everyone sees it on the fixture and in Results. */
export function ScoreEditor({ matchId, us, them, logged, teamName, opponent }: { matchId: string; us: number; them: number; logged: boolean; teamName: string; opponent: string }) {
  const router = useRouter();
  const [ours, setOurs] = useState(String(us));
  const [theirs, setTheirs] = useState(String(them));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { ok } = await send("/api/fixtures", "PATCH", { matchId, action: "score", ourGoals: Number(ours), opponentGoals: Number(theirs) });
    setBusy(false);
    if (!ok) return;
    haptic();
    toast("Result saved");
    router.refresh();
  }
  const box = "w-16 rounded-2xl border border-gray-200 bg-white py-2.5 text-center text-2xl font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-[#2c2c2e]";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-3">
        <label className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span className="max-w-24 truncate">{teamName}</span>
          <input inputMode="numeric" pattern="[0-9]*" value={ours} onChange={(e) => setOurs(e.target.value.replace(/\D/g, "").slice(0, 2))} className={box} aria-label={`${teamName} goals`} />
        </label>
        <span className="mt-5 text-2xl font-bold text-gray-400">–</span>
        <label className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span className="max-w-24 truncate">{opponent}</span>
          <input inputMode="numeric" pattern="[0-9]*" value={theirs} onChange={(e) => setTheirs(e.target.value.replace(/\D/g, "").slice(0, 2))} className={box} aria-label={`${opponent} goals`} />
        </label>
      </div>
      <button type="button" disabled={busy || ours === "" || theirs === ""} onClick={save} className="press rounded-2xl bg-green-700 py-3 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Saving…" : logged ? "Update result" : "Save result"}
      </button>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">Scorers, assists and awards are added in the Match Log.</p>
    </div>
  );
}

type Slot = { label: string; line: number; index: number; of: number };
type SquadPlayer = { id: string; name: string; answer: Answer };

/**
 * The line-up, on a pitch drawn from the back: pick the shape, then tap each
 * position to choose who plays there. Only coaches see it.
 */
export function LineupEditor({
  matchId,
  formations,
  initialFormation,
  initialSlots,
  slotsFor,
  squad,
}: {
  matchId: string;
  formations: string[];
  initialFormation: string;
  initialSlots: string[];
  slotsFor: Record<string, Slot[]>;
  squad: SquadPlayer[];
}) {
  const router = useRouter();
  const [formation, setFormation] = useState(initialFormation);
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const positions = slotsFor[formation] ?? [];
  const lines = Math.max(1, ...positions.map((p) => p.line));
  const byId = new Map(squad.map((p) => [p.id, p]));
  const placed = new Set(slots.filter(Boolean));
  const bench = squad.filter((p) => p.answer === "yes" && !placed.has(p.id));

  function changeFormation(next: string) {
    setFormation(next);
    // keep who's picked, in order, as far as the new shape has room
    const kept = slots.filter(Boolean);
    const size = slotsFor[next]?.length ?? 0;
    setSlots(Array.from({ length: size }, (_, i) => (i === 0 ? slots[0] ?? "" : kept.filter((id) => id !== slots[0])[i - 1] ?? "")));
    setDirty(true);
  }
  function put(i: number, id: string) {
    setSlots((s) => {
      const next = Array.from({ length: positions.length }, (_, j) => s[j] ?? "");
      // a player moved from one position to another leaves the first empty
      const was = next.indexOf(id);
      if (id && was >= 0) next[was] = "";
      next[i] = id;
      return next;
    });
    setPicking(null);
    setDirty(true);
  }
  async function save() {
    setBusy(true);
    const { ok } = await send("/api/fixtures", "PATCH", { matchId, action: "lineup", formation, slots });
    setBusy(false);
    if (!ok) return;
    setDirty(false);
    haptic();
    toast("Line-up saved");
    router.refresh();
  }

  const short = (name: string) => {
    const [first, ...rest] = name.split(/\s+/);
    return rest.length ? `${first} ${rest[rest.length - 1][0]}` : first;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="radiogroup" aria-label="Formation">
        {formations.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={formation === f}
            onClick={() => changeFormation(f)}
            className={`press rounded-full px-3.5 py-1.5 text-sm font-bold ${formation === f ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* the pitch, our goal at the bottom */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-700 to-emerald-800">
        <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x="0" y={i * 50} width="300" height="25" fill="rgba(255,255,255,0.04)" />
          ))}
          <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2">
            <rect x="12" y="12" width="276" height="376" rx="4" />
            <line x1="12" y1="200" x2="288" y2="200" />
            <circle cx="150" cy="200" r="34" />
            <rect x="85" y="330" width="130" height="58" />
            <rect x="85" y="12" width="130" height="58" />
          </g>
        </svg>
        {positions.map((p, i) => {
          // the keeper at the bottom, each line further up the pitch
          const top = p.line === 0 ? 88 : 88 - (p.line / lines) * 70;
          const left = ((p.index + 1) / (p.of + 1)) * 100;
          const player = byId.get(slots[i] ?? "");
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPicking(i)}
              style={{ top: `${top}%`, left: `${left}%` }}
              className="press absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              aria-label={`${p.label}: ${player ? player.name : "empty"} — choose`}
            >
              <span
                className={`grid h-11 w-11 place-items-center rounded-full text-xs font-extrabold shadow-md ${
                  player ? (i === 0 ? "bg-amber-400 text-amber-950" : "bg-white text-emerald-800") : "border-2 border-dashed border-white/70 text-white/90"
                }`}
              >
                {player ? player.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "+"}
              </span>
              <span className="max-w-full truncate rounded-md bg-black/35 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {player ? short(player.name) : p.label}
              </span>
            </button>
          );
        })}
      </div>

      {picking !== null && (
        <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Who plays {positions[picking]?.label}?</p>
            <button type="button" onClick={() => setPicking(null)} className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              Done
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {slots[picking] && (
              <button type="button" onClick={() => put(picking, "")} className="press rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                Leave empty
              </button>
            )}
            {[...squad]
              .sort((a, b) => (a.answer === "yes" ? 0 : a.answer === null ? 1 : 2) - (b.answer === "yes" ? 0 : b.answer === null ? 1 : 2))
              .map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => put(picking, pl.id)}
                  className={`press rounded-full px-3 py-1.5 text-sm font-semibold ${
                    slots[picking] === pl.id
                      ? "bg-green-700 text-white"
                      : pl.answer === "yes"
                        ? "bg-white text-gray-900 shadow-sm dark:bg-[#2c2c2e] dark:text-gray-50"
                        : "bg-transparent text-gray-400 ring-1 ring-gray-200 dark:ring-white/10"
                  }`}
                >
                  {short(pl.name)}
                  {pl.answer === "no" ? " ✕" : pl.answer === null ? " ?" : ""}
                  {placed.has(pl.id) && slots[picking] !== pl.id ? " •" : ""}
                </button>
              ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Players who said they can play come first. ✕ can&apos;t play, ? not answered, • already in a position.</p>
        </div>
      )}

      {bench.length > 0 && (
        <p className="text-sm">
          <span className="font-bold">Subs: </span>
          <span className="text-gray-600 dark:text-gray-300">{bench.map((p) => short(p.name)).join(", ")}</span>
        </p>
      )}

      <button type="button" disabled={busy || !dirty} onClick={save} className="press rounded-2xl bg-green-700 py-3 text-sm font-bold text-white disabled:opacity-40">
        {busy ? "Saving…" : dirty ? "Save line-up" : initialSlots.some(Boolean) ? "Line-up saved" : "Tap a position to start"}
      </button>
    </div>
  );
}
