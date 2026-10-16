import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { currentPerson } from "@/lib/people";
import SeasonAwards from "../components/SeasonAwards";

export const metadata = { title: "End of Season Awards" };

export default async function AwardsPage() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant) : null;
  if (!me) redirect("/signin?next=/awards");
  return <SeasonAwards />;
}