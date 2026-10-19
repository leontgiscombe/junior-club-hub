// What a club's hub shows while the platform admin has paused it (proxy.ts):
// nothing is deleted, and it opens again as soon as it's resumed.
import Link from "next/link";
import { redirect } from "next/navigation";
import { pausedClub } from "@/lib/clubStatus";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { inApp } from "@/lib/inAppServer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paused", robots: { index: false } };

export default async function PausedPage() {
  const tenant = await getTenant();
  const paused = tenant ? await pausedClub(tenant).catch(() => null) : null;
  if (!paused) redirect("/");
  const club = await getClub();
  const appView = await inApp();
  return (
    <main className="themed flex min-h-screen items-center justify-center bg-[#f2f2f7] px-6 text-center dark:bg-black">
      <div className="max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={club.crest.src} alt="" className="mx-auto h-24 w-auto" />
        {paused.trialEnded ? (
          <>
            <h1 className="mt-5 text-2xl font-extrabold text-gray-900 dark:text-gray-50">{club.name}
              {club.name.endsWith("s") ? "\u2019" : "\u2019s"} free trial has ended</h1>
            <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">
              Nothing has been lost: every team, player and record is kept.{" "}
              {appView
                ? "A club admin chooses a plan, and the hub opens again straight away."
                : "A club admin chooses a plan, from £4.99 a month, and the hub opens again straight away."}
            </p>
            {/* in the App Store app, the plans are bought with In-App Purchase (app/plans/AppPlans.tsx) */}
            <Link href="/plans" className="mt-5 block rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700">
              See the Plans
            </Link>
            <Link href="/support#contact" className="mt-3 block text-sm font-semibold text-gray-500 hover:text-green-700 dark:text-gray-400">
              Questions? Get in touch
            </Link>
          </>
        ) : (
          <>
        <h1 className="mt-5 text-2xl font-extrabold text-gray-900 dark:text-gray-50">{club.name}
          {club.name.endsWith("s") ? "\u2019" : "\u2019s"} hub is paused</h1>
        <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">
          Nothing has been lost: everything is kept, and the hub opens again as soon as it&apos;s back on. If you look
          after the club, check your email or get in touch with us.
        </p>
          </>
        )}
      </div>
    </main>
  );
}
