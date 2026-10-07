import AdminHome from "../components/AdminHome";
import { CLUB } from "@/club.config";

export const metadata = {
  title: `Coach Admin – ${CLUB.name}`,
  description: `Coaches' tools for ${CLUB.fullName}.`,
};

export default function CoachAdminPage() {
  return <AdminHome />;
}
