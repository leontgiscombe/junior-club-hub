import TrainingPlans from "../../../components/TrainingPlans";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Training Plans – ${CLUB.name}`,
    description: "Each team's weekly training plan and the club's drill library.",
  };
}

export default function TrainingPlansPage() {
  return <TrainingPlans />;
}
