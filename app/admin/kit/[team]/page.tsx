import { notFound } from "next/navigation";
import AdminView from "../../../components/AdminView";
import { isTeam } from "@/lib/settings";

export default async function TeamAdminPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  if (!(await isTeam(team))) notFound();

  return <AdminView lockedTeam={team} />;
}
