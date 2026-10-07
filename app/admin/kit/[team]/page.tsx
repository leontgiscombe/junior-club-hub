import { notFound } from "next/navigation";
import AdminView from "../../../components/AdminView";
import { TEAMS, isValidTeam } from "@/lib/teams";

export function generateStaticParams() {
  return TEAMS.map((team) => ({ team: team.slug }));
}

export default async function TeamAdminPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  if (!isValidTeam(team)) notFound();

  return <AdminView lockedTeam={team} />;
}
