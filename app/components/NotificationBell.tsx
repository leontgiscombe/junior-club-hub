"use client";

// The bell in the header (AppHeader): opens Notifications, with a red number
// for how many have come since they were last opened. It asks again whenever
// the app comes back on screen, and when Notifications has just been opened
// (INBOX_SEEN_EVENT). The last number is kept on the phone, so the bell shows
// it straight away on the next page instead of popping in.
import Link from "next/link";
import { useEffect, useState } from "react";

export const INBOX_SEEN_EVENT = "hub-inbox-seen";
const SAVED = "hub_inbox_unread";

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    try {
      const saved = Number(localStorage.getItem(SAVED));
      // the phone's own copy, only known once on the phone (the server draws no number)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved > 0) setUnread(saved);
    } catch {}
    const check = () =>
      fetch("/api/inbox?count=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { unread: 0 }))
        .then((d: { unread?: number }) => {
          const n = typeof d.unread === "number" ? d.unread : 0;
          if (!live) return;
          setUnread(n);
          try {
            localStorage.setItem(SAVED, String(n));
          } catch {}
        })
        .catch(() => {});
    check();
    const seen = () => {
      setUnread(0);
      try {
        localStorage.setItem(SAVED, "0");
      } catch {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener(INBOX_SEEN_EVENT, seen);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.removeEventListener(INBOX_SEEN_EVENT, seen);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
      className="press relative grid h-11 w-11 place-items-center rounded-full bg-white/85 text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md dark:bg-[#1c1c1e]/85 dark:text-gray-200 dark:ring-white/10"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white ring-2 ring-[#f2f2f7] dark:ring-black">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
