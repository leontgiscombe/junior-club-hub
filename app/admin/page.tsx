import AdminHome from "../components/AdminHome";
import { getClub } from "@/lib/settings";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Coach Admin – ${CLUB.name}`,
    description: `Coaches' tools for ${CLUB.fullName}.`,
  };
}

export default function CoachAdminPage() {
  return <AdminHome />;
}
