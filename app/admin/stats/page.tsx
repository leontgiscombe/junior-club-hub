import StatsTracker from "../../components/StatsTracker";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Stats Tracker – ${CLUB.name}`,
    description: `Per-team player stats for ${CLUB.fullName}.`,
  };
}

export default function StatsPage() {
  return <StatsTracker />;
}
