"use client";

// Keeps the page behind a pop-up still while it's open. Hiding the page's
// overflow isn't enough on an iPhone, where a swipe still scrolls what's
// behind: the page is pinned where it was (position: fixed at its scroll
// position) and put back exactly there on closing. Counted, so pop-ups
// opened over pop-ups share one lock.
import { useEffect } from "react";

let locks = 0;
let saved: { y: number; body: string; html: string } | null = null;

export function lockScroll() {
  if (locks++ > 0) return;
  const y = window.scrollY;
  const body = document.body.style.cssText;
  const html = document.documentElement.style.overflow;
  saved = { y, body, html };
  Object.assign(document.body.style, { position: "fixed", top: `-${y}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
  document.documentElement.style.overflow = "hidden";
}

export function unlockScroll() {
  if (locks === 0 || --locks > 0 || !saved) return;
  document.body.style.cssText = saved.body;
  document.documentElement.style.overflow = saved.html;
  window.scrollTo(0, saved.y);
  saved = null;
}

/** The page behind stays still while `active` (by default, while the component is shown). */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}
