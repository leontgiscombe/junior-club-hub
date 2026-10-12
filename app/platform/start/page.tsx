// The app's opening screen, on the platform's own address (/start): find your
// club as a player (scan or type the code a grown-up made) or as a parent or
// coach (the club's code), then on to the club's own hub. It remembers the
// club, so next time it's one tap.
import { PLATFORM_NAME, rootDomain } from "@/lib/tenant";
import NoTabBar from "../../components/NoTabBar";
import StartScreen from "./StartScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: `Welcome – ${PLATFORM_NAME}` };

export default function StartPage() {
  return (
    <main className="themed relative flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4 pb-10 pt-16">
      <NoTabBar />
      <StartScreen platform={PLATFORM_NAME} root={rootDomain()} />
    </main>
  );
}
