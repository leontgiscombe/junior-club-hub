// The teams step after signing a club up (and from Set Up Your Club): every
// team's details, and which one the admin coaches. Club admins only.
import { redirect } from "next/navigation";
import TeamsSetup from "../../components/TeamsSetup";
import { currentPerson } from "@/lib/people";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `Your Teams – ${(await getClub()).name}`, robots: { index: false } };
}

export default async function TeamsSetupPage() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant).catch(() => null) : null;
  if (me?.person?.status !== "approved" || !me.person.roles.includes("admin")) redirect("/admin");
  return <TeamsSetup />;
}
