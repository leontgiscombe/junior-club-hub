import MatchLog from "../../../components/MatchLog";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Match Log – ${CLUB.name}`,
    description: `Per-game goals and assists for ${CLUB.fullName}.`,
  };
}

export default function MatchLogPage() {
  return <MatchLog />;
}
