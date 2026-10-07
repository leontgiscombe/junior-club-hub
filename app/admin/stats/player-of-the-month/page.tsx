import { Anton, Barlow_Semi_Condensed } from "next/font/google";
import PlayerOfMonth from "../../../components/PlayerOfMonth";
import { getClub, requireFeature } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Player of the Month – ${CLUB.name}`,
    description: `Each month's player of the month and their poster for ${CLUB.fullName}.`,
  };
}

// the poster's lettering: a heavy condensed face for the headlines
const posterDisplay = Anton({ weight: "400", subsets: ["latin"], variable: "--font-poster" });
const posterBody = Barlow_Semi_Condensed({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poster-body",
});

export default async function PlayerOfMonthPage() {
  await requireFeature("playerOfMonth", "/admin");
  return <PlayerOfMonth posterFont={`${posterDisplay.variable} ${posterBody.variable}`} />;
}
