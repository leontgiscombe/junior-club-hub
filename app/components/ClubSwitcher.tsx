"use client";

// The club's crest at the top of Home, as a button: it opens a sheet with every
// club the account belongs to (a tick on this one), to switch to another, join
// one more with its code, or add and manage children here. Switching goes by
// the platform's opening screen, so the App Store app opens on the club picked
// next time too (app/platform/start/StartScreen.tsx, ?go).
import { useEffect, useState } from "react";
import Image from "next/image";
import type { Club } from "@/lib/clubSettings";

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

  // Escape closes it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your clubs"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-gray-900 shadow-xl dark:bg-[#1c1c1e] dark:text-gray-50"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden />
            <h2 className="text-lg font-extrabold">Your Clubs</h2>
            <div className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
              {!data && !failed && <p className="py-4 text-sm text-gray-500 dark:text-gray-400">Loading your clubs…</p>}
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
                  <button key={c.home} type="button" onClick={() => setOpen(false)} className="flex w-full items-center gap-4 py-3 text-left">{row}</button>
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
        </div>
      )}
    </>
  );
}
