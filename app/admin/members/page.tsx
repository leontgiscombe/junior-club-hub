import MembersAdmin from "../../components/MembersAdmin";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return { title: `Members – ${CLUB.name}` };
}

export default function MembersPage() {
  return <MembersAdmin />;
}
