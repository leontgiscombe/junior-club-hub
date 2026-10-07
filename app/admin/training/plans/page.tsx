import TrainingPlans from "../../../components/TrainingPlans";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Training Plans – ${CLUB.name}`,
  description: "Each team's weekly training plan and the club's drill library.",
};

export default function TrainingPlansPage() {
  return <TrainingPlans />;
}
