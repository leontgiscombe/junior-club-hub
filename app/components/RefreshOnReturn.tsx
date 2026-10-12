"use client";

// Home is drawn on the server, and going back to it shows the copy the phone
// already has — so something just changed (a mobile number added, someone
// approved) would still show the old way until the app was closed. This asks
// for a fresh copy whenever Home is come back to: by Back or the tab bar
// (not on the first load, which is fresh already), from the browser's
// back-forward cache, or when the app is reopened from the background.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

let loaded = false;

export default function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    if (loaded) router.refresh();
    loaded = true;
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
