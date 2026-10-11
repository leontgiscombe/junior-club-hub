import { notFound } from "next/navigation";
import KitForm from "../../components/KitForm";
import KitHeader, { KitFooter } from "../../components/KitHeader";
import { kitSquad } from "@/lib/kitSquad";
import { getClub, getTeams, requireFeature } from "@/lib/settings";
import { findTeam } from "@/lib/teams";

// the squad list comes from the stats tracker, so read it fresh each visit
export const dynamic = "force-dynamic";

export default async function KitTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  await requireFeature("kitSizes");
  const { team } = await params;
  const found = findTeam(await getTeams(), team);
  if (!found) notFound();
  const [squad, CLUB] = await Promise.all([kitSquad(team), getClub()]);

  return (
    <div className="themed flex min-h-screen flex-col bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      <KitHeader
        back={{ href: "/kit", label: "Teams" }}
        title={`${found.name} Kit`}
        subtitle={CLUB.fullName}
      />

      <main className="relative mx-auto mt-3 w-full max-w-md flex-1 px-4">
        <div>
          <p className="mb-4 px-1 text-center text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">
            Please choose the size for each item separately — your child can have a different
            size for each item. Use the size guide to help pick the right fit.
          </p>
          <KitForm team={team} squad={squad} extras={CLUB.kitExtras} />
        </div>
      </main>

      <KitFooter />
    </div>
  );
}
