"use client";

// The club's crest at the top of Home, as a button: it opens a sheet with every
// club the account belongs to (a tick on this one), to switch to another, join
// one more with its code, or add and manage children here. Switching goes by
// the platform's opening screen, so the App Store app opens on the club picked
// next time too (app/platform/start/StartScreen.tsx, ?go). The sheet slides up
// over the tab bar (hidden while it's open) and is swiped down to close.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import NoTabBar from "./NoTabBar";
import type { Club } from "@/lib/clubSettings";
import { RowsSkeleton } from "./Skeleton";

type MyClub = { name: string; crest: string; home: string; current: boolean; waiting: boolean };

export default function ClubSwitcher({ crest }: { crest: Club["crest"] }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ clubs: MyClub[]; start: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    fetch("/api/me/clubs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [open, data]);

  // swiping the sheet down: how far it's been pulled, and where the finger started
  const [pull, setPull] = useState(0);
  const [shown, setShown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; t: number; moved: boolean } | null>(null);
  // the last touch was a drag, so the click it ends with is ignored
  const dragged = useRef(false);
  const close = () => {
    setShown(false);
    setPull(0);
    setTimeout(() => setOpen(false), 200);
  };
  // slide up once it's on the page
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: Date.now(), moved: false };
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    // a tap stays a tap until the finger has really moved
    if (!d.moved && Math.abs(dy) < 8) return;
    if (!d.moved) {
      d.moved = true;
      dragged.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // down follows the finger; up only gives a little
    setPull(dy > 0 ? dy : dy / 4);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    setDragging(false);
    const dy = e.clientY - d.y;
    const fast = dy / Math.max(Date.now() - d.t, 1) > 0.5;
    if (dy > 100 || (dy > 30 && fast)) close();
    else setPull(0);
  };
  // a drag isn't a tap on whatever it started on
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  // Escape closes it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (c: MyClub) =>
    data && `${data.start}?go=${encodeURIComponent(c.home)}&name=${encodeURIComponent(c.name)}`;
  const action =
    "press flex w-full items-center justify-center gap-2 rounded-2xl bg-green-50 px-4 py-3.5 font-bold text-green-800 dark:bg-green-400/10 dark:text-green-300";

  return (
    <>
      <button type="button" onClick={() => { setFailed(false); setOpen(true); }} aria-label="Your clubs" aria-haspopup="dialog" className="press relative">
        <Image src={crest.src} unoptimized alt={crest.alt} width={crest.width} height={crest.height} className="h-11 w-auto" priority />
        <span aria-hidden className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white text-gray-600 shadow ring-1 ring-black/10 dark:bg-[#2c2c2e] dark:text-gray-200">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {/* on the page's body, so it sits above everything; the tab bar hides meanwhile */}
      {open && createPortal(
        <div
          className={`themed fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
          onClick={close}
        >
          <NoTabBar />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your clubs"
            onClick={(e) => e.stopPropagation()}
            onClickCapture={onClickCapture}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ transform: `translateY(${shown ? pull : 600}px)`, transition: dragging ? "none" : "transform 200ms ease-out" }}
            className="w-full max-w-xl touch-none select-none rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-gray-900 shadow-xl dark:bg-[#1c1c1e] dark:text-gray-50"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden />
            <h2 className="text-lg font-extrabold">Your Clubs</h2>
            <div className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {!data && !failed && <RowsSkeleton rows={2} />}
              {failed && <p className="py-4 text-sm text-red-600">Couldn&apos;t load your clubs — try again.</p>}
              {data?.clubs.map((c) => {
                const row = (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- another club's crest, from its own address */}
                    <img src={c.crest} alt="" className="h-12 w-12 shrink-0 rounded-xl object-contain ring-1 ring-black/5 dark:ring-white/10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{c.name}</span>
                      {(c.current || c.waiting) && (
                        <span className="block text-sm text-gray-500 dark:text-gray-400">{c.waiting ? "Waiting for approval" : "You're here"}</span>
                      )}
                    </span>
                    {c.current ? (
                      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Current club"><path d="m5 12 5 5 9-10" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                    )}
                  </>
                );
                return c.current ? (
                  <button key={c.home} type="button" onClick={close} className="flex w-full items-center gap-4 py-3 text-left">{row}</button>
                ) : (
                  <a key={c.home} href={go(c) ?? c.home} className="press flex items-center gap-4 py-3">{row}</a>
                );
              })}
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              <a href={data ? `${data.start}?pick=1&join=1` : "#"} className={action}>
                <span aria-hidden className="text-xl leading-none">+</span> Join another club
              </a>
              <a href="/account" className={action}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></svg>
                Add or manage children
              </a>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
