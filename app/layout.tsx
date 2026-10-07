import type { Metadata } from "next";
import "./globals.css";
import { getClubWithIcons, getTeams } from "@/lib/settings";
import { ClubProvider } from "./components/ClubProvider";
import { clubColourVars } from "@/lib/palette";

// Every page reads the club's saved settings, so none is built ahead of time.
export const dynamic = "force-dynamic";

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
  const [{ club }, teams] = await Promise.all([getClubWithIcons(), getTeams()]);
  return (
    // the club's colour, laid over the hub's green (lib/palette.ts)
    <html lang="en" className="h-full" style={clubColourVars(club.colour) as React.CSSProperties}>
      <body className="min-h-full bg-gray-50 font-sans antialiased">
        <ClubProvider club={club} teams={teams}>{children}</ClubProvider>
      </body>
    </html>
  );
}
