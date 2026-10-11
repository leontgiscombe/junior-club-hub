import Link from "next/link";
import Image from "next/image";
import { kitAspect } from "@/lib/clubSettings";
import { getClub, getTeams, requireFeature } from "@/lib/settings";
import KitHeader, { KitFooter } from "../components/KitHeader";
import { canCoach, currentPerson } from "@/lib/people";
import { teamsOf } from "@/lib/access";
import { getTenant } from "@/lib/tenant";

export const metadata = {
  title: "Kit Sizes – Pick Your Team",
  description: "Choose your team to set your child's kit size for the season.",
};

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default async function KitTeamPicker({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireFeature("kitSizes");
  const tenant = await getTenant();
  const [CLUB, TEAMS, me, { all }] = await Promise.all([
    getClub(),
    getTeams(),
    tenant ? currentPerson(tenant).catch(() => null) : null,
    searchParams,
  ]);
  // a signed-in parent (or player) sees just their own children's teams — the app knows them;
  // coaches, and anyone signed out, see every team (and a parent can still ask for them all)
  const person = me?.person?.status === "approved" ? me.person : null;
  const mine = person && !canCoach(person) ? teamsOf(person) : [];
  const ownOnly = mine.length > 0 && !all;
  const shown = ownOnly ? TEAMS.filter((t) => mine.includes(t.slug)) : TEAMS;
  return (
    <div className="themed flex min-h-screen flex-col bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      <KitHeader title="Kit Sizes" subtitle={CLUB.fullName} />

      <main className="relative mx-auto mt-3 w-full max-w-md flex-1 px-4">
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

        {/* the teams, as Home's grouped rows */}
        <h2 className="mt-6 mb-2.5 px-1 text-xl font-bold">
          {ownOnly ? (shown.length > 1 ? "Your children's teams" : "Your child's team") : "Choose your child's team"}
        </h2>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
          {shown.map((team) => (
            <Link key={team.slug} href={`/kit/${team.slug}`} className="press flex items-center gap-4 px-4 py-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-2xl dark:bg-green-400/10">
                {team.accent}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{team.name}</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Choose kit sizes</span>
              </span>
              <Chevron />
            </Link>
          ))}
        </div>
        <p className="mt-2.5 px-1 text-center text-xs text-gray-500 dark:text-gray-400">
          It takes a minute, and there&apos;s a size guide to help.
          {ownOnly && TEAMS.length > shown.length && (
            <>
              {" "}
              <Link href="/kit?all=1" className="font-semibold text-green-700 dark:text-green-400">
                Show all teams
              </Link>
            </>
          )}
        </p>

        {/* kit during the season: a new shirt, a lost jacket */}
        <Link href="/kit/request" className="press mt-6 flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8 12 3l9 5v8l-9 5-9-5z" />
              <path d="M3 8l9 5 9-5M12 13v8" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold">Request Kit</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">Need something during the season? Ask the coaches.</span>
          </span>
          <Chevron />
        </Link>
      </main>

      <KitFooter />
    </div>
  );
}
