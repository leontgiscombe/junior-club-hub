import type { Metadata } from "next";
import "./globals.css";
import { getClubWithIcons, getTeams } from "@/lib/settings";
import { PLATFORM_NAME, getTenant, platformUrl, rootDomain } from "@/lib/tenant";
import { tenantExists } from "@/lib/tenants";
import { cookies, headers } from "next/headers";
import { MEMBER_COOKIE, PATH_HEADER, readAccess, readMember } from "@/lib/access";
import { ClubProvider } from "./components/ClubProvider";
import { clubColourVars } from "@/lib/palette";

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
  if ((h.get(PATH_HEADER) ?? "").startsWith("/admin")) return false;
  try {
    if (!(await readAccess(tenant)).private) return false;
    const member = await readMember(tenant, (await cookies()).get(MEMBER_COOKIE)?.value ?? "");
    return member?.status !== "approved";
  } catch {
    return true;
  }
}

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
        <body className="flex min-h-full items-center justify-center bg-gray-50 p-6 text-center font-sans antialiased">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">There&apos;s no club here</h1>
            <p className="mt-2 text-gray-500">
              Check the address, or find your club on {PLATFORM_NAME}.
            </p>
            {rootDomain() && (
              <a href={platformUrl()} className="mt-4 inline-block font-bold text-green-700">
                Find your club →
              </a>
            )}
          </div>
        </body>
      </html>
    );
  }
  const [{ club }, allTeams, hideTeams] = await Promise.all([getClubWithIcons(), getTeams(), teamsHidden(tenant)]);
  const teams = hideTeams ? [] : allTeams;
  return (
    // the club's colour, laid over the hub's green (lib/palette.ts)
    <html lang="en" className="h-full" style={clubColourVars(club.colour) as React.CSSProperties}>
      <body className="min-h-full bg-gray-50 font-sans antialiased">
        <ClubProvider club={club} teams={teams}>{children}</ClubProvider>
      </body>
    </html>
  );
}
