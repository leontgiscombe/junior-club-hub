// What a club's hub shows while the platform admin has paused it (proxy.ts):
// nothing is deleted, and it opens again as soon as it's resumed.
import { redirect } from "next/navigation";
import { pausedClub } from "@/lib/clubStatus";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paused", robots: { index: false } };

export default async function PausedPage() {
  const tenant = await getTenant();
  const paused = tenant ? await pausedClub(tenant).catch(() => null) : null;
  if (!paused) redirect("/");
  const club = await getClub();
  return (
    <main className="themed flex min-h-screen items-center justify-center bg-[#f2f2f7] px-6 text-center dark:bg-black">
      <div className="max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={club.crest.src} alt="" className="mx-auto h-24 w-auto" />
        <h1 className="mt-5 text-2xl font-extrabold text-gray-900 dark:text-gray-50">{club.name}
          {club.name.endsWith("s") ? "\u2019" : "\u2019s"} hub is paused</h1>
        <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">
          Nothing has been lost: everything is kept, and the hub opens again as soon as it&apos;s back on. If you look
          after the club, check your email or get in touch with us.
        </p>
      </div>
    </main>
  );
}
