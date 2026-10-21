"use client";

// The Training Hub and Finances are pages outside the app's own routes
// (public/), so a link to one loads a whole new page, which no loading.tsx
// covers: the old page would just sit there. A tap on one shows the loading
// dots straight away instead, until the page arrives.
import { useEffect, useState } from "react";
import { LoadingCover } from "./Skeleton";

const OUTSIDE = /^\/(training-hub|finance)(\/|$)/;

export default function LeavingDots() {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && OUTSIDE.test(url.pathname)) setLeaving(true);
    };
    // back on this page from the browser's cache: not leaving any more
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) setLeaving(false);
    };
    document.addEventListener("click", click);
    window.addEventListener("pageshow", shown);
    return () => {
      document.removeEventListener("click", click);
      window.removeEventListener("pageshow", shown);
    };
  }, []);
  return leaving ? <LoadingCover /> : null;
}
