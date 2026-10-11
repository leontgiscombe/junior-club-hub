import AdminHome from "../components/AdminHome";
import { getClub } from "@/lib/settings";
import { DEFAULT_TENANT, getTenant } from "@/lib/tenant";
import { SIGNED_OUT, getViewer } from "@/lib/viewer";

export async function generateMetadata() {
  const CLUB = await getClub();
  return {
    title: `Coach Admin – ${CLUB.name}`,
    description: `Coaches' tools for ${CLUB.fullName}.`,
  };
}

export default async function CoachAdminPage() {
  const tenant = await getTenant();
  const viewer = await getViewer(tenant).catch(() => SIGNED_OUT);
  return (
    <AdminHome
      // clubs on the platform can reset a forgotten password by email
      canResetPassword={tenant !== DEFAULT_TENANT}
      // the header's photo or initials, as on Home
      viewer={{ signedIn: viewer.signedIn, initials: viewer.initials, photo: viewer.photo }}
    />
  );
}
