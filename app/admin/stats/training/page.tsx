import TrainingLog from "../../../components/TrainingLog";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Training Log – ${CLUB.name}`,
    description: `Monday training sessions and best trainer awards for ${CLUB.fullName}.`,
  };
}

export default function TrainingLogPage() {
  return <TrainingLog />;
}
