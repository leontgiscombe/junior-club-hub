// A player setting up their own device (lib/playerDevices.ts): they type the
// six-digit code a parent or coach made on their card, and this device opens
// the Training Hub as them from then on — nothing else in the hub.
import { getClub } from "@/lib/settings";
import { getTenant, rootDomain } from "@/lib/tenant";
import { currentPlayer, playerView } from "@/lib/playerRequest";
import NoTabBar from "../components/NoTabBar";
import PlayerLinkForm from "./PlayerLinkForm";
import AuthBackdrop from "../components/AuthBackdrop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player Setup", robots: { index: false } };

export default async function PlayerPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const tenant = await getTenant();
  const club = tenant ? await getClub() : null;
  const session = await currentPlayer();
  const player = session ? await playerView(session) : null;
  return (
    <main className="themed relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f2f2f7] dark:bg-black px-4 pb-10 pt-20">
      <AuthBackdrop />
      <NoTabBar />
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl dark:bg-[#1c1c1e]">
        <div className="mb-6 text-center">
          {club && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.crest.src} alt={club.crest.alt} className="mx-auto h-16 w-auto" />
          )}
          <h1 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-gray-50">
            {player ? `Hi ${player.firstName}!` : "I'm a Player"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{club?.name}</p>
        </div>
        {player ? (
          <>
            <p className="text-center text-sm text-gray-600 dark:text-gray-300">This device is set up for you.</p>
            <a href="/training-hub" className="mt-5 block rounded-xl bg-green-600 py-3.5 text-center font-bold text-white hover:bg-green-700">
              Open the Training Hub
            </a>
          </>
        ) : (
          <PlayerLinkForm initialCode={code ?? ""} root={rootDomain()} />
        )}
      </div>
    </main>
  );
}
