import MatchLog from "../../../components/MatchLog";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Match Log – ${CLUB.name}`,
  description: `Per-game goals and assists for ${CLUB.fullName}.`,
};

export default function MatchLogPage() {
  return <MatchLog />;
}
