"use client";

// The look of the hub's settings pages, like a phone's settings: a top bar with
// a round back button and the title, rounded groups of rows (icon, label,
// detail, arrow), and each row opening its own screen. Your Account, Club
// Settings and Financial Admin's settings all use it.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { backOr } from "@/lib/back";

/**
 * Which screen is open: "" for the main list, or one setting's id. It's kept
 * in the address's # (so a phone's back gesture works, and a link can open a
 * setting directly); `base` is where closing a directly-opened one goes.
 */
export function useScreens(base: string) {
  const [screen, setScreen] = useState("");
  const [pushed, setPushed] = useState(false);
  useEffect(() => {
    const read = () => setScreen(window.location.hash.slice(1));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const open = useCallback((id: string) => {
    setPushed(true);
    window.location.hash = id;
    window.scrollTo(0, 0);
  }, []);
  const close = useCallback(() => {
    if (pushed) window.history.back();
    else {
      window.history.replaceState(null, "", base + window.location.search);
      setScreen("");
    }
  }, [pushed, base]);
  return { screen, open, close };
}

export const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke}>
    {children}
  </svg>
);
export const ICONS = {
  person: svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0" /></>),
  clubs: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 0 1 5 5" /></>),
  child: svg(<><circle cx="12" cy="6" r="2.5" /><path d="M8 21v-6l-2-4 6 1 6-1-2 4v6M12 12v4" /></>),
  key: svg(<><circle cx="8" cy="8" r="4.5" /><path d="M11 11l9 9M16 16l2-2M18.5 18.5l2-2" /></>),
  bell: svg(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  shield: svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />),
  doc: svg(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>),
  out: svg(<><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>),
  bin: svg(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>),
  share: svg(<><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v8h14v-8" /></>),
  tag: svg(<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></>),
  palette: svg(<><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 2-1 3-1 4-1 4-4a8 8 0 0 0-9-8z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></>),
  crest: svg(<><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><circle cx="12" cy="11" r="2.5" /></>),
  shirt: svg(<path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" />),
  team: svg(<><circle cx="12" cy="7" r="3" /><circle cx="5" cy="10" r="2" /><circle cx="19" cy="10" r="2" /><path d="M7 20a5 5 0 0 1 10 0M1.5 19a3.5 3.5 0 0 1 6-2.5M22.5 19a3.5 3.5 0 0 0-6-2.5" /></>),
  grid: svg(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>),
  money: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>),
  moon: svg(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />),
  help: svg(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01" /></>),
  lock: svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
};

const BACK_ARROW = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke} strokeWidth={2.4}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

/** The bar at the top: a round back button and the screen's title. With href, it goes back to the page you came from, or up to href if there isn't one (lib/back.ts). */
export function TopBar({ title, onBack, href }: { title: React.ReactNode; onBack?: () => void; href?: string }) {
  const button = "absolute left-0 grid h-12 w-12 place-items-center rounded-full bg-white text-gray-900 shadow-md ring-1 ring-black/5 hover:bg-gray-50 dark:hover:bg-white/5 dark:bg-[#1c1c1e] dark:text-gray-50 dark:ring-white/10";
  return (
    <div className="sticky top-0 z-30 bg-[#f2f2f7]/90 dark:bg-black/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="relative mx-auto flex h-12 max-w-xl items-center justify-center">
        {href ? (
          <Link href={href} onClick={backOr} aria-label="Back" className={button}>
            {BACK_ARROW}
          </Link>
        ) : (
          <button onClick={onBack} aria-label="Back" className={button}>
            {BACK_ARROW}
          </button>
        )}
        <h1 className="max-w-[70%] truncate text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
      </div>
    </div>
  );
}

/** A rounded group of rows. */
export function Group({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e] dark:divide-white/10">{children}</div>;
}

/** One row: an icon, a label, maybe a detail, and an arrow. */
export function Row({
  icon,
  label,
  detail,
  danger,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={danger ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"}>{icon}</span>
      <span className={`flex-1 text-left text-[17px] ${danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50"}`}>{label}</span>
      {detail && <span className="max-w-[40%] truncate text-[15px] text-gray-400">{detail}</span>}
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true" {...stroke} strokeWidth={2.2}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </>
  );
  const className = "flex w-full items-center gap-4 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-white/5 dark:active:bg-white/10";
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
