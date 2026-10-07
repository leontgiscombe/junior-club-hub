import StatsPresentation from "../../../components/StatsPresentation";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Season Awards – ${CLUB.name}`,
  description: `End-of-season awards presentation for ${CLUB.fullName}.`,
};

export default function StatsPresentationPage() {
  return <StatsPresentation />;
}
