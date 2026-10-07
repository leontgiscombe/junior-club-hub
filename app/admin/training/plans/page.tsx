import TrainingPlans from "../../../components/TrainingPlans";
import { getClub, requireFeature } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Training Plans – ${CLUB.name}`,
    description: "Each team's weekly training plan and the club's drill library.",
  };
}

export default async function TrainingPlansPage() {
  await requireFeature("trainingPlans", "/admin");
  return <TrainingPlans />;
}
