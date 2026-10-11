import Link from "next/link";
import Image from "next/image";
import { kitAspect } from "@/lib/clubSettings";
import { getClub, getTeams, requireFeature } from "@/lib/settings";
import KitHeader, { KitFooter } from "../components/KitHeader";

export const metadata = {
  title: "Kit Sizes – Pick Your Team",
  description: "Choose your team to set your child's kit size for the season.",
};

export default async function KitTeamPicker() {
  await requireFeature("kitSizes");
  const [CLUB, TEAMS] = await Promise.all([getClub(), getTeams()]);
  return (
    <div className="themed flex min-h-screen flex-col bg-gray-50 dark:bg-black dark:text-gray-50">
      <KitHeader title="Kit Sizes" subtitle={CLUB.fullName} />

      <main className="relative mx-auto -mt-8 w-full max-w-md flex-1 px-4">
        {/* the new kits, without any team's sponsor */}
        <div className="relative overflow-hidden rounded-3xl bg-[var(--club-night)] shadow-lg">
          <div
            className="relative w-full"
            style={{ aspectRatio: kitAspect(CLUB.kitImage) }}
          >
            <Image
              src={CLUB.kitImage.src}
              unoptimized={CLUB.kitImage.src.startsWith("/api/")}
              alt={`The ${CLUB.kitSeason} kit`}
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-contain"
              priority
            />
          </div>
          <span className="absolute left-4 top-4 rounded-full bg-[var(--club-bright)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--club-night)] shadow">
            New for {CLUB.kitSeason}
          </span>
        </div>

        <p className="mt-6 mb-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Choose your child&apos;s team
        </p>
        <div className="flex flex-col gap-3">
          {TEAMS.map((team) => (
            <Link
              key={team.slug}
              href={`/kit/${team.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-green-400 hover:shadow-md dark:bg-[#1c1c1e] dark:border-white/15"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-xl dark:bg-white/10">
                {team.accent}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold text-gray-900 dark:text-gray-50">{team.name}</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Choose Kit Sizes</span>
              </span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-600 font-bold text-white transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-gray-400">
          It takes a minute, and there&apos;s a size guide to help.
        </p>
      </main>

      <KitFooter />
    </div>
  );
}
