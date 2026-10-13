"use client";

// Opens the page a tapped alert points to. The service worker (public/hub-sw.js)
// asks when the app's already open, since an iPhone won't let it move the window
// itself; and it keeps the page for a couple of minutes, which the app checks
// when it opens or comes back on screen — an iPhone often opens the app on its
// last page instead of the alert's. Draws nothing.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { onAlertTapped } from "@/lib/nativePush";

const OPEN_CACHE = "hub-open";
const OPEN_KEY = "/__hub-open";
const FRESH = 2 * 60 * 1000;
// only pages of this hub
const ours = (url: unknown): url is string => typeof url === "string" && url.startsWith("/") && !url.startsWith("//");

/** The page a just-tapped alert is for, if there is one (taken, so it's used once). */
async function takePending(): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  try {
    const c = await caches.open(OPEN_CACHE);
    const hit = await c.match(OPEN_KEY);
    if (!hit) return null;
    await c.delete(OPEN_KEY);
    const { url, at } = (await hit.json()) as { url?: unknown; at?: number };
    return ours(url) && typeof at === "number" && Date.now() - at < FRESH ? url : null;
  } catch {
    return null;
  }
}

export default function NotificationNav() {
  const router = useRouter();
  useEffect(() => {
    const go = (url: string) => {
      if (url === window.location.pathname + window.location.search + window.location.hash) return;
      // Finances is a page of its own, not one of the app's
      if (url.startsWith("/finance")) window.location.href = url;
      else router.push(url);
    };
    const check = () => {
      if (document.visibilityState === "visible") takePending().then((url) => url && go(url));
    };
    const onMessage = (e: MessageEvent) => {
      const url = e.data?.type === "hub-open" ? e.data.url : null;
      if (ours(url)) {
        takePending();
        go(url);
      }
    };
    check();
    // the App Store app's alerts (lib/nativePush.ts): a full address, maybe another club's
    const stopNative = onAlertTapped((url) => {
      const u = new URL(url);
      if (u.host === window.location.host) go(u.pathname + u.search + u.hash);
      else window.location.href = url;
    });
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      stopNative();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [router]);
  return null;
}
