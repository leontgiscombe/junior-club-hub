// Asking for kit during the season — a new shirt, a rain jacket — for a
// signed-in parent or player. The team's coaches get an alert, and see it in
// Kit Responses (lib/kitRequests.ts).
import Link from "next/link";
import KitHeader, { KitFooter } from "../../components/KitHeader";
import KitRequestForm from "../../components/KitRequestForm";
import { getClub, getTeams, requireFeature } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { currentPerson } from "@/lib/people";
import { itemsFor } from "@/lib/kitItems";
import { kitFamily, listKitRequests } from "@/lib/kitRequests";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request Kit" };

export default async function KitRequestPage() {
  await requireFeature("kitSizes");
  const tenant = await getTenant();
  const [CLUB, TEAMS, me] = await Promise.all([
    getClub(),
    getTeams(),
    tenant ? currentPerson(tenant).catch(() => null) : null,
  ]);
  const person = me?.person?.status === "approved" ? me.person : null;
  const family = person
    ? kitFamily(person).map((c) => ({ ...c, teamName: TEAMS.find((t) => t.slug === c.team)?.name ?? "" }))
    : [];
  const mine = person ? (await listKitRequests()).filter((r) => r.userId === person.userId) : [];
  if (person && family.length) redirect("/kit#new-request");

  const panel = "rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]";
  return (
    <div className="themed wp-page relative isolate flex min-h-screen flex-col bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
      <KitHeader back={{ href: "/kit", label: "Kit" }} title="Request Kit" subtitle={CLUB.fullName} />
      <main className="relative mx-auto mt-3 w-full max-w-md flex-1 px-4">
        {!me ? (
          <div className={`${panel} text-center`}>
            <p className="text-lg font-extrabold">Sign in to request kit</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              So the coaches know who&apos;s asking, and you can see when it&apos;s sorted.
            </p>
            <Link href="/signin?next=/kit/request" className="mt-4 block rounded-xl bg-green-600 py-3 font-bold text-white">
              Sign In
            </Link>
          </div>
        ) : !person ? (
          <div className={`${panel} text-center text-sm text-gray-500 dark:text-gray-400`}>
            Once the club has approved you, you can request kit here.
          </div>
        ) : family.length === 0 ? (
          <div className={`${panel} text-center text-sm text-gray-500 dark:text-gray-400`}>
            Add your child and their team in{" "}
            <Link href="/account" className="font-semibold text-green-700 dark:text-green-400">
              Your Account
            </Link>{" "}
            first, so the right coaches get your request.
          </div>
        ) : (
          <KitRequestForm
            family={family.map(({ id, name, teamName }) => ({ id, name, teamName }))}
            items={itemsFor(CLUB.kitExtras)}
            initial={mine.map((r) => ({
              id: r.id,
              childName: r.childName,
              item: r.item,
              size: r.size,
              quantity: r.quantity,
              note: r.note,
              createdAt: r.createdAt,
              doneAt: r.doneAt,
            }))}
          />
        )}
      </main>
      <KitFooter />
    </div>
  );
}
