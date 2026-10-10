"use client";

// The app's bottom tab bar, like an iPhone or Android app's: the club's main
// pages, plus Coach Admin for coaches or Financial Admin for treasurers. It
// shows on the main pages only (TAB_PAGES); the coach tools keep their own
// back links and bottom buttons.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Viewer } from "@/lib/viewer";
import { useClub } from "./ClubProvider";

/** The pages the bar shows on. */
export const TAB_PAGES = [/^\/$/, /^\/results$/, /^\/kit(\/|$)/, /^\/admin$/, /^\/account$/];

type Tab = { href: string; label: string; icon: React.ReactNode; match: (path: string) => boolean; external?: boolean };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke}>
    {children}
  </svg>
);

const HOME = <Icon><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></Icon>;
const TRAINING = <Icon><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M21 10l-5 0M3 10h5M9.5 14.5 7 19M14.5 14.5 17 19" /></Icon>;
const RESULTS = <Icon><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4M8 20h8M10 17h4v3h-4z" /></Icon>;
const KIT = <Icon><path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" /></Icon>;
const COACH = <Icon><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></Icon>;
const FINANCE = <Icon><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></Icon>;
const ACCOUNT = <Icon><circle cx="12" cy="8.5" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;

export default function TabBar({ viewer }: { viewer: Viewer }) {
  const club = useClub();
  const path = usePathname() ?? "/";
  if (!TAB_PAGES.some((p) => p.test(path))) return null;

  const tabs: Tab[] = [{ href: "/", label: "Home", icon: HOME, match: (p) => p === "/" }];
  if (club.features.trainingHub) tabs.push({ href: "/training-hub", label: "Training", icon: TRAINING, match: () => false, external: true });
  tabs.push({ href: "/results", label: "Results", icon: RESULTS, match: (p) => p === "/results" });
  if (club.features.kitSizes) tabs.push({ href: "/kit", label: "Kit", icon: KIT, match: (p) => p.startsWith("/kit") });
  if (viewer.canCoach) tabs.push({ href: "/admin", label: "Coach", icon: COACH, match: (p) => p.startsWith("/admin") });
  else if (viewer.canFinance && club.features.financialAdmin) {
    tabs.push({ href: "/finance", label: "Finance", icon: FINANCE, match: () => false, external: true });
  }
  if (!viewer.signedIn) tabs.push({ href: "/signin", label: "Sign In", icon: ACCOUNT, match: () => false });
  else if (tabs.length < 5) tabs.push({ href: "/account", label: "Account", icon: ACCOUNT, match: (p) => p === "/account" });

  return (
    <>
      {/* room for the bar, so it never covers the end of the page */}
      <div aria-hidden="true" className="h-[calc(4.25rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((t) => {
            const active = t.match(path);
            const className = `flex h-[4.25rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              active ? "text-green-700" : "text-gray-500 hover:text-gray-900"
            }`;
            return (
              <li key={t.href} className="flex-1">
                {t.external ? (
                  // plain pages outside the app's own routes (public/)
                  <a href={t.href} className={className}>
                    {t.icon}
                    {t.label}
                  </a>
                ) : (
                  <Link href={t.href} className={className} aria-current={active ? "page" : undefined}>
                    {t.icon}
                    {t.label}
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
