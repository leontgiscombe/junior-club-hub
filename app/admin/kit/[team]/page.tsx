import { notFound } from "next/navigation";
import AdminView from "../../../components/AdminView";
import { isTeam, requireFeature } from "@/lib/settings";

export default async function TeamAdminPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  await requireFeature("kitSizes", "/admin");
  const { team } = await params;
  if (!(await isTeam(team))) notFound();

  return <AdminView lockedTeam={team} />;
}
