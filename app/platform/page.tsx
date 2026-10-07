// The platform's own home page, on the root domain: what the hub does, find
// your club, and sign a new club up.
import Image from "next/image";
import Link from "next/link";
import { Anton } from "next/font/google";
import { PLATFORM_NAME } from "@/lib/tenant";
import FindClub from "./FindClub";

export const metadata = {
  title: `${PLATFORM_NAME} – Everything your junior football club needs`,
  description:
    "Match and training logs, player of the month posters, kit sizes, subs and a training app for the players — one hub for your club.",
};

const display = Anton({ weight: "400", subsets: ["latin"] });

const FEATURES = [
  ["⚽", "Match Log", "Fixtures from FA Full-Time, scores, scorers, assists and awards."],
  ["🏃", "Training", "Each Monday's session, best trainer, and weekly plans from a drill library."],
  ["🌟", "Player of the Month", "Worked out from the awards, with a poster ready to share."],
  ["📊", "Stats & Presentation", "Season totals, milestones and a slideshow for awards night."],
  ["👕", "Kit Sizes", "Parents pick their child and send sizes; you see who's missing."],
  ["💷", "Financial Admin", "Subs, who's paid and spending, encrypted with each team's password."],
  ["🧠", "Player Training Hub", "A tactics guide, quizzes and skill challenges for the players."],
  ["🎨", "Your Club's Look", "Your badge, colours, teams and slogan on every page."],
];

export default function PlatformHome() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="relative overflow-hidden bg-[var(--club-night)] px-6 pb-16 pt-14 text-center text-white">
        <Image src="/poster/brush-background.jpg" alt="" fill priority sizes="100vw" className="object-cover object-top opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-transparent to-green-950/80" />
        <div className="relative mx-auto max-w-2xl">
          <h1 className={`${display.className} text-5xl uppercase leading-none tracking-wide drop-shadow-[4px_4px_0_rgba(0,0,0,0.8)] sm:text-6xl`}>
            {PLATFORM_NAME}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-green-50">
            Everything your junior football club needs, in one place — for coaches, parents and the
            players.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-2xl bg-[var(--club-bright)] px-6 py-3.5 font-extrabold text-[var(--club-night)] shadow-lg hover:opacity-90">
              Start Your Club →
            </Link>
            <a href="#find" className="rounded-2xl bg-white/10 px-6 py-3.5 font-bold text-white ring-1 ring-white/30 hover:bg-white/20">
              Find Your Club
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-8 w-full max-w-3xl flex-1 px-5 pb-12">
        <section id="find" className="relative rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
          <h2 className="text-xl font-extrabold text-gray-900">Find Your Club</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">Parents and coaches: find your club and save it to your phone.</p>
          <FindClub />
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(([icon, title, body]) => (
            <div key={title} className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-2xl">{icon}</span>
              <span>
                <span className="block font-extrabold text-gray-900">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-gray-500">{body}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl bg-gray-900 p-7 text-center text-white">
          <h2 className={`${display.className} text-3xl uppercase tracking-wide`}>Set Up in Minutes</h2>
          <p className="mx-auto mt-2 max-w-md text-gray-300">
            Pick your club&apos;s web address, add your badge, colours and teams, and share the link
            with your parents.
          </p>
          <Link href="/signup" className="mt-5 inline-block rounded-2xl bg-[var(--club-bright)] px-6 py-3.5 font-extrabold text-[var(--club-night)] hover:opacity-90">
            Start Your Club →
          </Link>
        </section>
      </main>

      <footer className="bg-[var(--club-night)] px-6 py-8 text-center text-sm text-gray-400">{PLATFORM_NAME}</footer>
    </div>
  );
}
