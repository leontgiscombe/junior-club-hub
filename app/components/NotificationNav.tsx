"use client";

// Opens the page an alert points to when it's tapped while the app is already
// open — the service worker (public/hub-sw.js) asks, since an iPhone won't let
// it move the window itself. Draws nothing.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NotificationNav() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const url = e.data?.type === "hub-open" && typeof e.data.url === "string" ? e.data.url : null;
      // only pages of this hub
      if (url && url.startsWith("/") && !url.startsWith("//")) router.push(url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}
