import TrainingLog from "../../../components/TrainingLog";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Training Log – ${CLUB.name}`,
  description: `Monday training sessions and best trainer awards for ${CLUB.fullName}.`,
};

export default function TrainingLogPage() {
  return <TrainingLog />;
}
