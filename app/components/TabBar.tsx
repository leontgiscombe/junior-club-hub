"use client";

// The app's bottom tab bar — a floating frosted bar like iOS's, light or dark: the club's main
// pages, Finances for treasurers and club admins, and Coach Admin for coaches. It
// shows on the tabs' own pages only (TAB_PAGES); every other page is one you
// go into and come back from, with a round back button (BackButton).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Viewer } from "@/lib/viewer";
import { useClub } from "./ClubProvider";
import { useJoinRequests } from "./JoinAlerts";

/** The pages the bar shows on. */
export const TAB_PAGES = [/^\/$/, /^\/kit$/, /^\/admin$/];

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
  external?: boolean;
  /** a red count on the icon (people waiting to join, on Coach) */
  badge?: number;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke}>
    {children}
  </svg>
);

const HOME = <Icon><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></Icon>;
const TRAINING = <Icon><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M21 10l-5 0M3 10h5M9.5 14.5 7 19M14.5 14.5 17 19" /></Icon>;
const KIT = <Icon><path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" /></Icon>;
const COACH = <Icon><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></Icon>;
const FINANCE = <Icon><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></Icon>;
const ACCOUNT = <Icon><circle cx="12" cy="8.5" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;

export default function TabBar({ viewer }: { viewer: Viewer }) {
  const club = useClub();
  const path = usePathname() ?? "/";
  const onTabPage = TAB_PAGES.some((p) => p.test(path));
  // people waiting for approval, for the Coach tab's badge
  const { status: joins } = useJoinRequests(undefined, viewer.canCoach && onTabPage);
  if (!onTabPage) return null;

  const tabs: Tab[] = [{ href: "/", label: "Home", icon: HOME, match: (p) => p === "/" }];
  if (club.features.trainingHub) tabs.push({ href: "/training-hub", label: "Training", icon: TRAINING, match: () => false, external: true });
  // Finances for whoever can open it (signed out we can't tell, so it shows); Results is on the home page
  if (club.features.financialAdmin && (viewer.canFinance || !viewer.signedIn)) {
    tabs.push({ href: "/finance", label: "Finances", icon: FINANCE, match: () => false, external: true });
  }
  if (club.features.kitSizes) tabs.push({ href: "/kit", label: "Kit", icon: KIT, match: (p) => p.startsWith("/kit") });
  if (viewer.canCoach) {
    tabs.push({ href: "/admin", label: "Coach", icon: COACH, match: (p) => p.startsWith("/admin"), badge: joins?.pending });
  }
  if (!viewer.signedIn) tabs.push({ href: "/signin", label: "Sign In", icon: ACCOUNT, match: () => false });
  else if (tabs.length < 5) tabs.push({ href: "/account", label: "Account", icon: ACCOUNT, match: (p) => p === "/account" });

  return (
    <>
      {/* room for the bar, so it never covers the end of the page */}
      <div aria-hidden="true" className="h-[calc(6rem+env(safe-area-inset-bottom))]" />
      {/* a floating frosted bar, set in from the edges like iOS's: light on light pages, dark in dark mode */}
      <nav
        aria-label="Main"
        className="themed fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
