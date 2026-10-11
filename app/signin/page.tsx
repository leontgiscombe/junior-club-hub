// Sign in to your account (lib/auth.ts), on a club's address or the platform's.
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/safeNext";
import { getClub } from "@/lib/settings";
import { PLATFORM_NAME, getTenant } from "@/lib/tenant";
import BackButton from "../components/BackButton";
import NoTabBar from "../components/NoTabBar";
import SignInForm from "../components/SignInForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign In", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  const to = safeNext(next);
  if (await currentUser()) redirect(to);
  const tenant = await getTenant();
  const club = tenant ? await getClub() : null;
  return (
    <main className="themed relative flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4 pb-10 pt-20">
      <NoTabBar />
      <BackButton href="/" label="Home" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl dark:bg-[#1c1c1e]">
        <div className="mb-6 text-center">
          {club ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.crest.src} alt={club.crest.alt} className="mx-auto h-16 w-auto" />
          ) : (
            <div className="text-4xl">⚽</div>
          )}
          <h1 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-gray-50">Sign In</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{club ? club.name : PLATFORM_NAME}</p>
        </div>
        {expired && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            That sign-in link has run out or was already used. Send yourself a new one.
          </p>
        )}
        <SignInForm next={to} />
      </div>
    </main>
  );
}
