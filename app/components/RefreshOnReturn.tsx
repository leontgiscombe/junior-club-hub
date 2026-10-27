"use client";

// Home is drawn on the server, and the phone keeps the copy it has: going back
// to it shows that copy straight away. If that copy is more than a little
// while old, someone may have changed something since (a mobile number added,
// someone approved), so this asks for a fresh one — but not when the copy has
// only just arrived, which would fetch Home twice. Also when the page comes
// back from the browser's back-forward cache, or the app is reopened from the
// background. (A save of your own refreshes it already: FreshAfterSave.)
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const FRESH_MS = 30_000;
// when this phone first showed each copy of Home, by the time it was drawn
const firstShown = new Map<number, number>();

export default function RefreshOnReturn({ drawnAt }: { drawnAt: number }) {
  const router = useRouter();
  useEffect(() => {
    const shown = firstShown.get(drawnAt);
    if (shown === undefined) firstShown.set(drawnAt, Date.now());
    else if (Date.now() - shown > FRESH_MS) router.refresh();
  }, [drawnAt, router]);
  useEffect(() => {
    let hiddenAt = 0;
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      // back from another app (more than a few seconds away)
      else if (hiddenAt && Date.now() - hiddenAt > 5000) router.refresh();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
