"use client";

// The app's bottom tab bar — a floating frosted bar like iOS's, light or dark.
// Which tabs: lib/tabs.ts (each person can choose their own, Your Account → Tab
// Bar). It shows on the tabs' own pages; every other page is one you go into
// and come back from, with a round back button (BackButton).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Viewer } from "@/lib/viewer";
import { TABS_EVENT, chosenTabs, loadSavedTabs, tabDef, type TabContext, type TabId } from "@/lib/tabs";
import { useClub } from "./ClubProvider";
import { useJoinRequests } from "./JoinAlerts";

/** The pages the bar always shows on; a page someone has made a tab shows it too. */
export const TAB_PAGES = [/^\/$/, /^\/kit$/, /^\/admin$/];

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Each tab's icon (also shown in Your Account → Tab Bar). */
export const TAB_ICONS: Record<TabId, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>,
  training: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M21 10l-5 0M3 10h5M9.5 14.5 7 19M14.5 14.5 17 19" /></>,
  finances: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  kit: <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" />,
  coach: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>,
  results: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></>,
  account: <><circle cx="12" cy="8.5" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  matches: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /></>,
  trainingLog: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  stats: <path d="M5 20V10M12 20V4M19 20v-7" />,
  members: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M19 8v6M16 11h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
};

export function TabIcon({ id, className = "h-6 w-6" }: { id: TabId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      {TAB_ICONS[id]}
    </svg>
  );
}

export default function TabBar({ viewer }: { viewer: Viewer }) {
  const club = useClub();
  const path = usePathname() ?? "/";
  const ctx: TabContext = {
    signedIn: viewer.signedIn,
    canCoach: viewer.canCoach,
    canFinance: viewer.canFinance,
    features: club.features,
    publicResults: club.publicResults,
  };
  // this phone's chosen tabs (Your Account → Tab Bar), once the page knows them
  const [saved, setSaved] = useState<unknown>(null);
  useEffect(() => {
    const read = () => setSaved(loadSavedTabs());
    read();
    window.addEventListener(TABS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(TABS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const ids = chosenTabs(ctx, saved);
  const defs = ids.map((id) => ({ id, ...tabDef(id, ctx) }));
  const onTabPage = TAB_PAGES.some((p) => p.test(path)) || defs.some((d) => !d.external && d.match(path));
  // people waiting for approval, for the Coach tab's badge
  const { status: joins } = useJoinRequests(undefined, viewer.canCoach && onTabPage && ids.includes("coach"));
  if (!onTabPage) return null;
  const tabs = defs.map((d) => ({ ...d, icon: <TabIcon id={d.id} />, badge: d.id === "coach" ? joins?.pending : undefined }));

  return (
    <>
      {/* room for the bar, so it never covers the end of the page */}
      <div aria-hidden="true" className="hub-tabbar h-[calc(6rem+env(safe-area-inset-bottom))]" />
      {/* a floating frosted bar, set in from the edges like iOS's: light on light pages, dark in dark mode */}
      <nav
        aria-label="Main"
        className="hub-tabbar themed fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <ul className="mx-auto flex max-w-xl gap-0.5 rounded-full bg-white/85 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.16)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 dark:bg-[#1c1c1e]/85 dark:ring-white/10">
          {tabs.map((t) => {
            const active = t.match(path);
            const className = `press relative flex h-[3.6rem] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors ${
              active
                ? "bg-green-700/10 font-bold text-green-700 dark:bg-green-400/15 dark:text-green-400"
                : "font-semibold text-gray-600 dark:text-gray-300"
            }`;
            const inner = (
              <>
                <span className="relative">
                  {t.icon}
                  {!!t.badge && (
                    <span className="absolute -right-3 -top-2 min-w-[1.25rem] rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white ring-2 ring-white dark:ring-[#1c1c1e]">
                      {t.badge > 99 ? "99+" : t.badge}
                    </span>
                  )}
                </span>
                {t.label}
              </>
            );
            return (
              <li key={t.href} className="flex-1">
                {t.external ? (
                  // plain pages outside the app's own routes (public/)
                  <a href={t.href} className={className}>
                    {inner}
                  </a>
                ) : (
                  <Link href={t.href} className={className} aria-current={active ? "page" : undefined}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
