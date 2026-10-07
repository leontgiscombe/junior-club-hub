import type { Metadata } from "next";
import "./globals.css";
import { CLUB } from "@/club.config";

export const metadata: Metadata = {
  title: `${CLUB.name} – Team Hub`,
  description: `Training, kit sizes and team admin for ${CLUB.fullName}, all in one place.`,
  // The crest on the paint-stroke background, for phone home screens
  icons: { icon: "/club-crest.png", apple: "/hub-icon-180.png" },
  appleWebApp: { title: `${CLUB.initials} Hub` },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
