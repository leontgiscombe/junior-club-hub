// The row at the top of the tab bar's main pages (Home, Coach Admin): your
// photo or initials (Your Account, or Sign In), Search, and the club's crest
// (the club switcher).
// No hooks: server and client pages both use it.
import Link from "next/link";
import Image from "next/image";
import type { Club } from "@/lib/clubSettings";
import ClubSwitcher from "./ClubSwitcher";

export type HeaderViewer = { signedIn: boolean; initials: string; photo: string | null; switcher?: boolean };

// the crest opens the club switcher for someone signed in on the platform (lib/viewer.ts)
export default function AppHeader({ viewer, crest }: { viewer: HeaderViewer; crest: Club["crest"] }) {
  const switcher = !!viewer.switcher;
  return (
    <div className="flex items-center justify-between pt-2">
      <Link
        href={viewer.signedIn ? "/account" : "/signin"}
        aria-label={viewer.signedIn ? "Your account" : "Sign in"}
        className="press grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-green-700 text-base font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#1c1c1e]"
      >
        {viewer.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- your own photo, private to you
          <img src={viewer.photo} alt="" className="h-full w-full object-cover" />
        ) : viewer.signedIn ? (
          viewer.initials
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        )}
      </Link>
      <span className="flex items-center gap-3">
        {/* Search: pages, settings and (for those allowed) the club's own data */}
        <Link
          href="/search"
          aria-label="Search"
          className="press grid h-11 w-11 place-items-center rounded-full bg-white/85 text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md dark:bg-[#1c1c1e]/85 dark:text-gray-200 dark:ring-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
        {switcher ? (
          <ClubSwitcher crest={crest} />
        ) : (
          <Image src={crest.src} unoptimized alt={crest.alt} width={crest.width} height={crest.height} className="h-11 w-auto" priority />
        )}
      </span>
    </div>
  );
}
