"use client";

// The home screen's shortcuts, which each person picks for themselves (kept on
// this phone): Edit opens a list of every tool they can use, to tick up to
// MAX and put in order. Until they do, the page's own default four show.
// A long press on one works like a phone's home screen: they wiggle, each with
// a − to take it off, a + to add more, and Done.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "./useScrollLock";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/haptics";

export type ShortcutId =
  | "matches"
  | "training"
  | "stats"
  | "potm"
  | "plans"
  | "camera"
  | "kitResponses"
  | "members"
  | "settings"
  | "help"
  | "results"
  | "finances"
  | "finSubs"
  | "finOwes"
  | "finSpending"
  | "finSettings"
  | "hub"
  | "kit";

type Tool = { href: string; label: string; colour: string; icon: React.ReactNode; external?: boolean };

const svg = (children: React.ReactNode) => children;
const TOOLS: Record<ShortcutId, Tool> = {
  matches: { href: "/admin/stats/matches", label: "Match Log", colour: "bg-green-700", icon: svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14M7 10v4M15.5 10h2v4h-2z" /></>) },
  training: { href: "/admin/stats/training", label: "Training Log", colour: "bg-cyan-700", icon: svg(<><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>) },
  stats: { href: "/admin/stats", label: "Stats", colour: "bg-indigo-600", icon: svg(<path d="M5 20V10M12 20V4M19 20v-7" />) },
  potm: { href: "/admin/stats/player-of-the-month", label: "Player of the Month", colour: "bg-amber-700", icon: svg(<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />) },
  plans: { href: "/admin/training/plans", label: "Training Plans", colour: "bg-blue-700", icon: svg(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>) },
  camera: { href: "/admin/camera", label: "Camera", colour: "bg-rose-700", icon: svg(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>) },
  kitResponses: { href: "/admin/kit", label: "Kit Responses", colour: "bg-orange-700", icon: svg(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>) },
  members: { href: "/admin/members", label: "Members", colour: "bg-emerald-700", icon: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M19 8v6M16 11h6" /></>) },
  settings: { href: "/admin/settings", label: "Settings", colour: "bg-gray-600", icon: svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>) },
  help: { href: "/admin/help", label: "Help", colour: "bg-slate-700", icon: svg(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01" /></>) },
  results: { href: "/results", label: "Results", colour: "bg-yellow-700", icon: svg(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></>) },
  finances: { href: "/finance", label: "Finances", colour: "bg-emerald-800", icon: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>), external: true },
  // straight to one of Finances' tabs (the page opens on it once the team's open)
  finSubs: { href: "/finance?view=subs", label: "Subs", colour: "bg-emerald-700", icon: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>), external: true },
  finOwes: { href: "/finance?view=outstanding", label: "Who Owes", colour: "bg-red-700", icon: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>), external: true },
  finSpending: { href: "/finance?view=expenses", label: "In & Out", colour: "bg-violet-700", icon: svg(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>), external: true },
  finSettings: { href: "/finance?view=settings", label: "Finance Settings", colour: "bg-gray-600", icon: svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>), external: true },
  hub: { href: "/training-hub", label: "Training Hub", colour: "bg-green-800", icon: svg(<><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M21 10l-5 0M3 10h5M9.5 14.5 7 19M14.5 14.5 17 19" /></>), external: true },
  kit: { href: "/kit", label: "Kit Sizes", colour: "bg-orange-600", icon: svg(<path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" />) },
};

const MAX = 8;
const KEY = "hub_shortcuts";

function Tile({ tool, small = false }: { tool: Tool; small?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center text-white ${tool.colour} ${small ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl"}`}>
      <svg viewBox="0 0 24 24" className={small ? "h-5 w-5" : "h-7 w-7"} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {tool.icon}
      </svg>
    </span>
  );
}

export default function HomeShortcuts({ available, defaults }: { available: ShortcutId[]; defaults: ShortcutId[] }) {
  const [chosen, setChosen] = useState<ShortcutId[]>(defaults);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ShortcutId[]>([]);
  // wiggling, after a long press: − takes one off, + adds
  const [arranging, setArranging] = useState(false);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  // the tap that ends a long press doesn't open the shortcut
  const swallowClick = useRef(false);

  function pressStart(e: React.PointerEvent) {
    // a new press: whatever tap the last long press might have led to has gone
    swallowClick.current = false;
    if (arranging) return;
    const x = e.clientX, y = e.clientY;
    press.current = {
      x,
      y,
      timer: window.setTimeout(() => {
        press.current = null;
        swallowClick.current = true;
        setArranging(true);
        haptic();
      }, 500),
    };
  }
  function pressEnd() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    // a phone may or may not send a tap after a long press: only one straight after it is ignored
    if (swallowClick.current) window.setTimeout(() => (swallowClick.current = false), 400);
  }
  function pressMove(e: React.PointerEvent) {
    // a scroll, not a press
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) pressEnd();
  }
  function tileClick(e: React.MouseEvent) {
    if (arranging || swallowClick.current) e.preventDefault();
    swallowClick.current = false;
  }

  // this phone's own choice, if it has one (only tools this person can still use)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as string[] | null;
      // the old Players shortcut is Members now (the squad lives there)
      const ids = Array.isArray(saved) ? [...new Set(saved.map((id) => (id === "players" ? "members" : id)))] : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice is only known in the browser
      if (ids) setChosen(ids.filter((id): id is ShortcutId => available.includes(id as ShortcutId)).slice(0, MAX));
    } catch {}
  }, [available]);

  // while the list is open, the page behind it stays still
  useScrollLock(editing);

  function save(next: ShortcutId[] | null) {
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {}
    setChosen(next ?? defaults);
    setEditing(false);
  }
  const remove = (id: ShortcutId) => {
    const next = chosen.filter((x) => x !== id);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setChosen(next);
  };
  const openList = () => {
    setDraft(chosen);
    setEditing(true);
  };
  const more = chosen.length < MAX && available.some((id) => !chosen.includes(id));

  const toggle = (id: ShortcutId) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < MAX ? [...d, id] : d));
  const move = (id: ShortcutId, by: -1 | 1) =>
    setDraft((d) => {
      const i = d.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="wp-text text-xl font-bold">Shortcuts</h2>
        {arranging ? (
          <button onClick={() => setArranging(false)} className="wp-text press text-[15px] font-bold text-green-700 dark:text-green-400">
            Done
          </button>
        ) : (
          <button onClick={openList} className="wp-text press text-[15px] font-semibold text-green-700 dark:text-green-400">
            Edit
          </button>
        )}
      </div>
      <style>{`@keyframes hub-wiggle{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}`}</style>
      {chosen.length > 0 || arranging ? (
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {chosen.map((id, i) => {
            const tool = TOOLS[id];
            const inner = (
              <>
                <span className="relative" style={arranging ? { animation: `hub-wiggle .3s ease-in-out ${i % 2 ? "-.15s" : "0s"} infinite` } : undefined}>
                  <Tile tool={tool} />
                </span>
                {tool.label}
              </>
            );
            const className = "wp-text press flex select-none flex-col items-center gap-1.5 text-center text-xs font-semibold leading-tight [-webkit-touch-callout:none]";
            const handlers = {
              onPointerDown: pressStart,
              onPointerUp: pressEnd,
              onPointerLeave: pressEnd,
              onPointerCancel: pressEnd,
              onPointerMove: pressMove,
              onClick: tileClick,
              onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
            };
            const link = tool.external ? (
              <a href={tool.href} className={className} {...handlers}>
                {inner}
              </a>
            ) : (
              <Link href={tool.href} className={className} {...handlers}>
                {inner}
              </Link>
            );
            return (
              <div key={id} className="relative">
                {link}
                {arranging && (
                  <button
                    onClick={() => remove(id)}
                    aria-label={`Remove ${tool.label}`}
                    className="absolute -top-1.5 left-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-gray-500 text-white shadow ring-2 ring-white dark:bg-gray-400 dark:text-gray-900 dark:ring-black"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
                  </button>
                )}
              </div>
            );
          })}
          {arranging && more && (
            <button onClick={openList} className="wp-text press flex flex-col items-center gap-1.5 text-center text-xs font-semibold leading-tight">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 dark:border-white/25 dark:text-gray-500">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              Add
            </button>
          )}
        </div>
      ) : (
        <p className="wp-text px-1 text-sm text-gray-500 dark:text-gray-400">No shortcuts — tap Edit to add some.</p>
      )}
      {arranging && <p className="wp-text px-1 text-center text-xs text-gray-500 dark:text-gray-400">Tap − to remove one, or + to add. Tap Done when you&apos;re finished.</p>}

      {/* on the page's body, not in here: the page's slide-in wrapper would keep it under the tab bar */}
      {editing && createPortal(
        <div className="themed fixed inset-0 z-50 flex items-end overscroll-contain justify-center bg-black/40 sm:items-center" onClick={() => setEditing(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit shortcuts"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-[#f2f2f7] pb-[max(1rem,env(safe-area-inset-bottom))] text-gray-900 shadow-2xl dark:bg-[#1c1c1e] dark:text-gray-50 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <button onClick={() => save(null)} className="text-[15px] font-semibold text-gray-500 dark:text-gray-400">
                Reset
              </button>
              <h2 className="text-[17px] font-semibold">Shortcuts</h2>
              <button onClick={() => save(draft)} className="text-[15px] font-bold text-green-700 dark:text-green-400">
                Done
              </button>
            </div>
            <p className="px-5 pb-3 text-center text-sm text-gray-500 dark:text-gray-400">
              Tick up to {MAX} and put them in order. {draft.length} of {MAX} chosen.
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white dark:divide-white/10 dark:bg-black/40">
                {/* the chosen ones first, in order, then the rest */}
                {[...draft, ...available.filter((id) => !draft.includes(id))].map((id) => {
                  const on = draft.includes(id);
                  const i = draft.indexOf(id);
                  return (
                    <li key={id} className="flex items-center gap-3 px-4 py-2.5">
                      <Tile tool={TOOLS[id]} small />
                      <span className="flex-1 text-[16px]">{TOOLS[id].label}</span>
                      {on && (
                        <span className="flex gap-1">
                          <button onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${TOOLS[id].label} up`} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 disabled:opacity-25 dark:text-gray-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                          </button>
                          <button onClick={() => move(id, 1)} disabled={i === draft.length - 1} aria-label={`Move ${TOOLS[id].label} down`} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 disabled:opacity-25 dark:text-gray-400">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                        </span>
                      )}
                      <button
                        onClick={() => toggle(id)}
                        aria-pressed={on}
                        aria-label={on ? `Remove ${TOOLS[id].label}` : `Add ${TOOLS[id].label}`}
                        disabled={!on && draft.length >= MAX}
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 disabled:opacity-30 ${
                          on ? "border-green-600 bg-green-600 text-white" : "border-gray-300 dark:border-white/25"
                        }`}
                      >
                        {on && (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      , document.body)}
    </section>
  );
}
