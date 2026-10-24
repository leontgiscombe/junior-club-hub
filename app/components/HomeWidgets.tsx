"use client";

// Home's cards — next training and next match (under Up next), the last result
// and Finances — which each person can hide on their own phone. A long press on
// one works like a phone's home screen: they wiggle, each with a − to hide it,
// the hidden ones wait below as + buttons to put back, and Done. Kept in a
// cookie, so Home is drawn without them from the start.
import { useRef, useState } from "react";
import { HIDDEN_COOKIE, type WidgetId } from "@/lib/homeWidgets";
import { haptic } from "@/lib/haptics";

type Widget = { id: WidgetId; label: string; node: React.ReactNode };

function saveHidden(ids: string[]) {
  document.cookie = `${HIDDEN_COOKIE}=${ids.join(".")}; path=/; max-age=31536000; samesite=lax`;
}

export default function HomeWidgets({ widgets, hidden: initial, upNextClass }: { widgets: Widget[]; hidden: string[]; upNextClass: string }) {
  const [hidden, setHidden] = useState<string[]>(initial);
  const [arranging, setArranging] = useState(false);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  // the tap that ends a long press doesn't open the card
  const swallowClick = useRef(false);

  function keep(next: string[]) {
    setHidden(next);
    saveHidden(next);
  }
  const hide = (id: WidgetId) => keep([...new Set([...hidden, id])]);
  const show = (id: WidgetId) => keep(hidden.filter((x) => x !== id));

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
  function onClickCapture(e: React.MouseEvent) {
    const onBadge = (e.target as HTMLElement).closest("[data-widget-control]");
    if ((arranging && !onBadge) || swallowClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    swallowClick.current = false;
  }

  const shown = widgets.filter((w) => !hidden.includes(w.id));
  const away = widgets.filter((w) => hidden.includes(w.id));
  const upNext = shown.filter((w) => w.id === "training" || w.id === "match");
  const rest = shown.filter((w) => w.id !== "training" && w.id !== "match");
  if (!widgets.length) return null;

  // a card, wiggling with its − while arranging
  const item = (w: Widget, i: number, cls?: string) => (
    <div
      key={w.id}
      className="relative"
      style={arranging ? { animation: `hub-wiggle-card .35s ease-in-out ${i % 2 ? "-.17s" : "0s"} infinite` } : undefined}
    >
      {cls ? <div className={cls}>{w.node}</div> : w.node}
      {arranging && (
        <button
          data-widget-control
          onClick={() => hide(w.id)}
          aria-label={`Hide ${w.label}`}
          className="absolute -left-1.5 -top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-gray-500 text-white shadow ring-2 ring-white dark:bg-gray-400 dark:text-gray-900 dark:ring-black"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
      )}
    </div>
  );

  return (
    <div
      className="flex select-none flex-col gap-6 [-webkit-touch-callout:none]"
      onPointerDown={pressStart}
      onPointerUp={pressEnd}
      onPointerLeave={pressEnd}
      onPointerCancel={pressEnd}
      onPointerMove={pressMove}
      onClickCapture={onClickCapture}
      onContextMenu={(e) => arranging && e.preventDefault()}
    >
      <style>{`@keyframes hub-wiggle-card{0%,100%{transform:rotate(-.6deg)}50%{transform:rotate(.6deg)}}`}</style>
      {arranging && (
        <div className="-mb-3 flex items-center justify-between gap-3 px-1">
          <p className="wp-text text-sm text-gray-500 dark:text-gray-400">Tap − to hide a card, + to put one back.</p>
          <button data-widget-control onClick={() => setArranging(false)} className="wp-text press shrink-0 text-[15px] font-bold text-green-700 dark:text-green-400">
            Done
          </button>
        </div>
      )}
      {upNext.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="wp-text px-1 text-xl font-bold">Up next</h2>
          {arranging ? (
            <div className="flex flex-col gap-2.5">
              {upNext.map((w, i) => item(w, i, upNextClass))}
            </div>
          ) : (
            <div className={upNextClass}>{upNext.map((w) => <div key={w.id}>{w.node}</div>)}</div>
          )}
        </section>
      )}
      {rest.map((w, i) => item(w, i + upNext.length))}
      {arranging && away.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {away.map((w) => (
            <button
              key={w.id}
              data-widget-control
              onClick={() => show(w.id)}
              className="press flex items-center gap-1.5 rounded-full border-2 border-dashed border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-600 dark:border-white/25 dark:text-gray-300"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              {w.label}
            </button>
          ))}
        </div>
      )}
      {/* every card hidden: a way back without a long press */}
      {!arranging && shown.length === 0 && (
        <button onClick={() => setArranging(true)} className="wp-text press self-start px-1 text-sm font-semibold text-green-700 dark:text-green-400">
          + Show cards
        </button>
      )}
    </div>
  );
}
