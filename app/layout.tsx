import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getClubWithIcons, getTeams } from "@/lib/settings";
import { withoutTraining } from "@/lib/clubSettings";
import { PLATFORM_NAME, getTenant, platformUrl, rootDomain } from "@/lib/tenant";
import { tenantExists } from "@/lib/tenants";
import { cookies, headers } from "next/headers";
import { MEMBER_COOKIE, PATH_HEADER, SESSION_COOKIE, isApprovedPerson, readAccess, readMember } from "@/lib/access";
import { ClubProvider } from "./components/ClubProvider";
import { clubColourVars } from "@/lib/palette";
import { SIGNED_OUT, getViewer } from "@/lib/viewer";
import { DARK_BAR, LIGHT_BAR, THEME_COOKIE, THEME_SCRIPT } from "@/lib/theme";
import TabBar from "./components/TabBar";
import LeavingDots from "./components/LeavingDots";
import BackTracker from "./components/BackTracker";
import NotificationNav from "./components/NotificationNav";
import HomeWallpaper from "./components/HomeWallpaper";

// Every page reads the club's saved settings, so none is built ahead of time.
export const dynamic = "force-dynamic";

/**
 * Whether to leave the club's teams out of this page: a private club's pages
 * that anyone can open (the join page, the legal pages…) don't show its teams
 * to people who aren't members. Coach Admin keeps them, for the coach tools.
 */
async function teamsHidden(tenant: string | null): Promise<boolean> {
  if (!tenant) return false;
  const h = await headers();
  // a paused club (proxy.ts) shows nothing of its teams
  if (h.get(PATH_HEADER) === "/paused") return true;
  if ((h.get(PATH_HEADER) ?? "").startsWith("/admin")) return false;
  try {
    if (!(await readAccess(tenant)).private) return false;
    const jar = await cookies();
    if ((await readMember(tenant, jar.get(MEMBER_COOKIE)?.value ?? ""))?.status === "approved") return false;
    return !(await isApprovedPerson(tenant, jar.get(SESSION_COOKIE)?.value ?? ""));
  } catch {
    return true;
  }
}

// edge to edge on phones, so the tab bar can sit above the home indicator
export const viewport: Viewport = {
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const { club, icons } = await getClubWithIcons();
  return {
    title: `${club.name} – Team Hub`,
    description: `Training, kit sizes and team admin for ${club.fullName}, all in one place.`,
    // the crest on the paint-stroke background, for phone home screens
    icons: { icon: icons.icon, apple: icons.apple },
    appleWebApp: { title: `${club.initials} Hub` },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // an address that isn't a club (yet)
  const tenant = await getTenant();
  if (tenant && !(await tenantExists(tenant))) {
    return (
      <html lang="en" className="h-full">
        <body className="relative isolate flex min-h-full items-center justify-center bg-gray-50 p-6 text-center font-sans antialiased">
          <HomeWallpaper />
          <div className="max-w-sm rounded-lg bg-gray-50 p-6">
            <h1 className="text-2xl font-extrabold text-gray-900">There&apos;s no club here</h1>
            <p className="mt-2 text-gray-500">
              Check the address, or find your club on {PLATFORM_NAME}.
            </p>
            {rootDomain() && (
              // the app would otherwise reopen this address, if it's the club it remembered
              <a href={platformUrl("/start?pick=1&forget=1")} className="mt-4 inline-block font-bold text-green-700">
                Find your club →
              </a>
            )}
          </div>
        </body>
      </html>
    );
  }
  const [{ club }, allTeams, hideTeams, viewer] = await Promise.all([
    getClubWithIcons(),
    getTeams(),
    teamsHidden(tenant),
    getViewer(tenant).catch(() => SIGNED_OUT),
  ]);
  // each team's training times stay off the page (anyone can open it): the
  // Training Log, Settings and a family's own Up next fetch them for those allowed
  const teams = hideTeams ? [] : allTeams.map(withoutTraining);
  return (
    // the club's colour, laid over the hub's green (lib/palette.ts)
    // dark is drawn from the start when it's the saved choice; "Match my phone" is settled by THEME_SCRIPT
    <html
      lang="en"
      className={`h-full${(await cookies()).get(THEME_COOKIE)?.value === "dark" ? " dark" : ""}`}
      style={clubColourVars(club.colour) as React.CSSProperties}
      suppressHydrationWarning
    >
      <head>
        {/* the status bar matches the page, light or dark (THEME_SCRIPT and the Appearance picker keep it to the chosen one) */}
        <meta name="theme-color" content={(await cookies()).get(THEME_COOKIE)?.value === "dark" ? DARK_BAR : LIGHT_BAR} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* pull to refresh, haptics, swiping back, which way pages slide (public/app-feel.js) */}
        <script src="/app-feel.js" defer />
      </head>
      <body className="relative isolate min-h-full bg-gray-50 font-sans antialiased">
        <HomeWallpaper />
        <ClubProvider club={club} teams={teams}>
          {children}
          {/* the app's tab bar — a club's hub only (not the platform's own site), and not for someone a private club hasn't let in yet */}
          {tenant && !hideTeams && <TabBar viewer={viewer} />}
          <BackTracker />
          <NotificationNav />
          <LeavingDots />
        </ClubProvider>
      </body>
    </html>
  );
}
