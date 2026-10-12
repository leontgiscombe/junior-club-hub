import AdminHome from "../components/AdminHome";
import { getClub } from "@/lib/settings";
import { DEFAULT_TENANT, getTenant } from "@/lib/tenant";
import { SIGNED_OUT, getViewer } from "@/lib/viewer";
import { redirect } from "next/navigation";
import { canCoach, currentPerson } from "@/lib/people";
import { setupFor } from "@/lib/setupChecklist";

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
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  // a member it isn't for (a parent, a treasurer) goes to Home — an old invite's link led here
  if (me?.person?.status === "approved" && !canCoach(me.person)) redirect("/");
  const setup = tenant && me ? await setupFor(tenant, me.user, me.person).catch(() => null) : null;
  return (
    <AdminHome
      // clubs on the platform can reset a forgotten password by email
      canResetPassword={tenant !== DEFAULT_TENANT}
      // the header's photo or initials, as on Home
      viewer={{ signedIn: viewer.signedIn, initials: viewer.initials, photo: viewer.photo }}
      setup={setup}
    />
  );
}
