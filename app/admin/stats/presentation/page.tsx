import StatsPresentation from "../../../components/StatsPresentation";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Season Awards – ${CLUB.name}`,
    description: `End-of-season awards presentation for ${CLUB.fullName}.`,
  };
}

export default function StatsPresentationPage() {
  return <StatsPresentation />;
}
