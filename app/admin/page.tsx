import AdminHome from "../components/AdminHome";
import { getClub } from "@/lib/settings";
import { DEFAULT_TENANT, getTenant } from "@/lib/tenant";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Coach Admin – ${CLUB.name}`,
    description: `Coaches' tools for ${CLUB.fullName}.`,
  };
}

export default async function CoachAdminPage() {
  // clubs on the platform can reset a forgotten password by email
  return <AdminHome canResetPassword={(await getTenant()) !== DEFAULT_TENANT} />;
}
