import { notFound } from "next/navigation";
import KitForm from "../../components/KitForm";
import KitHeader, { KitFooter } from "../../components/KitHeader";
import { kitSquad } from "@/lib/kitSquad";
import { getClub, getTeams } from "@/lib/settings";
import { findTeam } from "@/lib/teams";

// the squad list comes from the stats tracker, so read it fresh each visit
export const dynamic = "force-dynamic";

export default async function KitTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  const found = findTeam(await getTeams(), team);
  if (!found) notFound();
  const [squad, CLUB] = await Promise.all([kitSquad(team), getClub()]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <KitHeader
        back={{ href: "/kit", label: "Teams" }}
        title={`${found.name} Kit`}
        subtitle={CLUB.fullName}
      />

      <main className="relative mx-auto -mt-8 w-full max-w-md flex-1 px-4">
        <div className="rounded-3xl bg-white px-4 pt-6 shadow-lg">
          <p className="mb-5 text-center text-sm leading-relaxed text-gray-500">
            Please choose the size for each item separately — your child can have a different
            size shirt to shorts or socks. Use the size guide to help pick the right fit.
          </p>
          <KitForm team={team} squad={squad} />
        </div>
      </main>

      <KitFooter />
    </div>
  );
}
