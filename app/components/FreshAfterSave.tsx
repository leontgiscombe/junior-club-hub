"use client";

// Pages the phone has just seen are kept for a little while (staleTimes in
// next.config.ts), so going back to one is instant. Something saved — a
// child's sizes, a result, someone approved — would then still show the old
// way there, so after a save the app quietly asks for fresh copies: this page
// is redrawn and the kept ones are dropped. A burst of saves (ticking down a
// list) asks once. Draws nothing.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const QUIET_MS = 800;

export default function FreshAfterSave() {
  const router = useRouter();
  useEffect(() => {
    const original = window.fetch;
    let timer: ReturnType<typeof setTimeout> | undefined;
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (res.ok && method !== "GET" && method !== "HEAD" && url.origin === location.origin) {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), QUIET_MS);
        }
      } catch {}
      return res;
    };
    return () => {
      clearTimeout(timer);
      window.fetch = original;
    };
  }, [router]);
  return null;
}
