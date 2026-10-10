// Just signed in with an emailed code or link: offer to add a passkey, once
// (PasskeyOffer goes straight on if there's no point asking).
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listPasskeys } from "@/lib/passkeys";
import { safeNext } from "@/lib/safeNext";
import PasskeyOffer from "./PasskeyOffer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign In Faster", robots: { index: false } };

export default async function PasskeyOfferPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await currentUser();
  if (!user) redirect(next);
  const hasOne = (await listPasskeys(user.id)).length > 0;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl">
        <PasskeyOffer next={next} hasOne={hasOne} />
      </div>
    </main>
  );
}
