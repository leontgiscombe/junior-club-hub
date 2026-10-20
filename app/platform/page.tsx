// The platform's own home page, on the root domain: what the hub does, go to
// your club (by its address — clubs aren't listed), and sign a new club up.
import Image from "next/image";
import Link from "next/link";
import { Anton } from "next/font/google";
import { PLATFORM_NAME } from "@/lib/tenant";
import FindClub from "./FindClub";
import PlanList from "../components/PlanList";
import { TRIAL_DAYS } from "@/lib/billing";
import { operator } from "@/lib/legal";

export const metadata = {
  title: `${PLATFORM_NAME} – Everything your junior football club needs`,
  description:
    "Match and training logs, player of the month posters, kit sizes, subs and a training app for the players — one hub for your club.",
};

const display = Anton({ weight: "400", subsets: ["latin"] });

// the App Store listing, once the app is live there (APP_STORE_URL on Render)
const appStoreUrl = () => process.env.APP_STORE_URL?.trim() || "";

// screens from the app (public/site/), with what each shows
const SCREENS = [
  ["/site/home.jpg", "Home", "What's next for your team, the last result and your shortcuts."],
  ["/site/match-log.jpg", "Match Log", "Fixtures from FA Full-Time; scores, scorers and awards in a few taps."],
  ["/site/training.jpg", "Training Hub", "The players' own app: how we play, quizzes and skill challenges."],
  ["/site/coach-admin.jpg", "Coach Admin", "Every coach's tool in one place."],
];

const STEPS = [
  ["Start your club", "Pick your club's address, add your badge, colours and teams. It takes a few minutes, and it's free for 30 days."],
  ["Share your club code", "Send the code or the QR to parents and coaches by WhatsApp or email, or put it up at training."],
  ["Parents join, you approve", "Families sign in with their own email and add their child. You approve them and they're in."],
];

const FAQS = [
  ["Do parents have to pay?", "No. One subscription covers the whole club. Parents, coaches and players never pay anything."],
  ["Is children's information safe?", "Each club's hub is private to its approved members. Children's details, photos and medical notes are only seen by their own parents and the club's coaches, and team finances are stored encrypted."],
  ["What happens after the free trial?", "A club admin chooses a plan by the number of teams. If you don't, the hub pauses: nothing is deleted, and it opens again as soon as you subscribe."],
  ["Can we cancel?", "Any time. Your plan runs to the end of the month or year you've paid for."],
  ["We have lots of teams. Is that a problem?", "No. Large Club covers any number of teams, from the youngest to the oldest."],
  ["Is there an app?", "Yes — Grassroots Club Hub for iPhone, and the same hub works in any browser on Android, tablets and computers."],
];

const FEATURES = [
  ["⚽", "Match Log", "Fixtures from FA Full-Time, scores, scorers, assists and awards."],
  ["🏃", "Training", "Every training session at each team's own times, best trainer, and weekly plans from a drill library."],
  ["🌟", "Player of the Month", "Worked out from the awards, with a poster ready to share."],
  ["📊", "Stats & Presentation", "Season totals, milestones and a slideshow for awards night."],
  ["👕", "Kit Sizes", "Parents pick their child and send sizes; you see who's missing."],
  ["💷", "Finances", "Subs, who's paid and spending, stored encrypted, opened by each team's treasurer with Face ID."],
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
              Join Your Club
            </a>
          </div>
          {appStoreUrl() && <AppStoreBadge href={appStoreUrl()} className="mt-5" />}
        </div>
      </header>

      <main className="mx-auto -mt-8 w-full max-w-3xl flex-1 px-5 pb-12">
        <section id="find" className="relative rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
          <h2 className="text-xl font-extrabold text-gray-900">Join Your Club</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">
            Parents and players: type the club code your coach gave you. Once a coach approves you,
            get the iPhone app or save the hub to your phone&apos;s home screen.
          </p>
          <FindClub />
        </section>

        <section className="mt-10">
          <h2 className={`${display.className} text-3xl uppercase tracking-wide`}>See It in Action</h2>
          <p className="mt-1 text-sm text-gray-600">The same hub on the iPhone app and in any browser.</p>
          {/* swiped through on a phone; side by side on a wider screen */}
          <div className="-mx-5 mt-4 flex snap-x gap-4 overflow-x-auto px-5 pb-3 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
            {SCREENS.map(([src, title, body]) => (
              <figure key={src} className="w-52 shrink-0 snap-start sm:w-auto">
                <div className="overflow-hidden rounded-[2rem] border-[6px] border-gray-900 bg-gray-900 shadow-xl">
                  <Image src={src} alt={`${title} in Grassroots Club Hub`} width={600} height={1246} sizes="208px" className="h-auto w-full" />
                </div>
                <figcaption className="mt-2 px-1">
                  <span className="block font-extrabold text-gray-900">{title}</span>
                  <span className="block text-sm text-gray-500">{body}</span>
                </figcaption>
              </figure>
            ))}
          </div>
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

        <section className="mt-10">
          <h2 className={`${display.className} text-3xl uppercase tracking-wide`}>How It Works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-green-600 font-extrabold text-white">{i + 1}</span>
                <span className="mt-3 block font-extrabold text-gray-900">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-gray-500">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* the prices (never shown in the App Store app: proxy.ts sends it to /start instead) */}
        <section id="pricing" className="mt-8">
          <h2 className={`${display.className} text-3xl uppercase tracking-wide`}>Pricing</h2>
          <p className="mt-1 text-sm text-gray-600">
            One price for the whole club, by its number of teams. {TRIAL_DAYS} days free first, no card needed.
            Monthly or yearly; cancel any time. Parents, coaches and players never pay.
          </p>
          <div className="mt-4">
            <PlanList />
          </div>
        </section>

        <section className="mt-10">
          <h2 className={`${display.className} text-3xl uppercase tracking-wide`}>Questions</h2>
          <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-gray-900">
                  {q}
                  <span className="text-green-700 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-green-50 text-3xl" aria-hidden="true">⚽</span>
          <span className="flex-1">
            <span className="block font-extrabold text-gray-900">Built by Leon, a coach at Pudsey Juniors</span>
            <span className="mt-1 block text-sm leading-relaxed text-gray-600">
              I built the hub for my own club, to stop chasing kit sizes, results and subs across group chats — and now
              other grassroots clubs can use it too. Questions, ideas or problems? I&apos;d love to hear from you.
            </span>
          </span>
          {operator().email && (
            <a href={`mailto:${operator().email}`} className="shrink-0 rounded-2xl bg-gray-900 px-5 py-3 font-bold text-white hover:bg-gray-800">
              Get in Touch
            </a>
          )}
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
          <p className="mt-3 text-sm opacity-80">30 days free, no card needed. Then from £4.99 a month for the whole club.</p>
          {appStoreUrl() && <AppStoreBadge href={appStoreUrl()} className="mt-5" />}
        </section>
      </main>

      <footer className="bg-[var(--club-night)] px-6 py-8 text-center text-sm text-gray-400">
        {PLATFORM_NAME}
        <p className="mt-3 text-xs text-gray-500">
          <a href="/privacy" className="hover:text-gray-300">Privacy</a>
          {" · "}
          <a href="/terms" className="hover:text-gray-300">Terms</a>
          {" · "}
          <a href="/support" className="hover:text-gray-300">Support</a>
        </p>
      </footer>
    </div>
  );
}

/** "Download on the App Store", in the style of Apple's badge. */
function AppStoreBadge({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      className={`mx-auto inline-flex items-center gap-2.5 rounded-xl bg-black px-4 py-2 text-left text-white ring-1 ring-white/40 hover:bg-gray-900 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M16.37 12.7c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.23c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.55 1.31-.56.65-1.05 1.69-.92 2.69.97.08 1.97-.49 2.57-1.23z" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[10px]">Download on the</span>
        <span className="block text-lg font-semibold">App Store</span>
      </span>
    </a>
  );
}
