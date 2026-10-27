// The app's opening screen, on the platform's own address (/start): find your
// club as a player (scan or type the code a grown-up made) or as a parent or
// coach (the club's code), then on to the club's own hub. It remembers the
// club, so next time it's one tap.
import { PLATFORM_NAME, rootDomain } from "@/lib/tenant";
import NoTabBar from "../../components/NoTabBar";
import StartScreen from "./StartScreen";
import { currentUser } from "@/lib/auth";
import { clubsOfUser } from "@/lib/userClubs";
import { inApp } from "@/lib/inAppServer";
import AuthBackdrop from "../../components/AuthBackdrop";

export const dynamic = "force-dynamic";
export const metadata = { title: `Welcome – ${PLATFORM_NAME}` };

export default async function StartPage() {
  // signed in: their clubs, one tap each
  const user = await currentUser().catch(() => null);
  const clubs = user ? (await clubsOfUser(user.id).catch(() => [])).map((c) => ({ name: c.name, home: c.url })) : null;
  return (
    <main className="themed relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f2f2f7] dark:bg-black px-4 pb-10 pt-16">
      <AuthBackdrop />
      <NoTabBar />
      <StartScreen platform={PLATFORM_NAME} root={rootDomain()} clubs={clubs} appView={await inApp()} />
    </main>
  );
}
