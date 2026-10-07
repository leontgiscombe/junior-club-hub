import HelpManual from "../../components/HelpManual";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Help – ${CLUB.name}`,
    description: `How to use the ${CLUB.fullName} Team Hub.`,
  };
}

export default function HelpPage() {
  return <HelpManual />;
}
