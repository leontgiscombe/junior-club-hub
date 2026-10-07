import PlayersAdmin from "../../components/PlayersAdmin";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return { title: `Players – ${CLUB.name}` };
}

export default function PlayersPage() {
  return <PlayersAdmin />;
}
