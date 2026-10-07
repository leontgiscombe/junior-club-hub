import StatsTracker from "../../components/StatsTracker";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Stats Tracker – ${CLUB.name}`,
  description: `Per-team player stats for ${CLUB.fullName}.`,
};

export default function StatsPage() {
  return <StatsTracker />;
}
