import Link from "next/link";
import Image from "next/image";
import { Anton } from "next/font/google";
import { CLUB, TEAMS } from "@/club.config";

export const metadata = {
  title: `${CLUB.name} – Team Hub`,
  description: `Training, kit sizes and team admin for ${CLUB.fullName}, all in one place.`,
};

// the same heavy lettering as the player of the month poster
const display = Anton({ weight: "400", subsets: ["latin"] });

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Banner: the poster's dry-brush paint strokes under a green wash */}
      <header className="relative overflow-hidden bg-[#060906] px-6 pb-12 pt-12 text-center text-white">
        <Image
          src="/poster/brush-background.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-transparent to-green-950/80" />
        <div className="relative">
          <Image
            src={CLUB.crest.src}
            alt={CLUB.crest.alt}
            width={CLUB.crest.width}
            height={CLUB.crest.height}
            className="mx-auto mb-5 h-32 w-auto"
            priority
          />
          <h1
            className={`${display.className} text-5xl uppercase leading-none tracking-wide drop-shadow-[4px_4px_0_rgba(0,0,0,0.8)] sm:text-6xl`}
          >
            {CLUB.name}
          </h1>
          <p className={`${display.className} mt-2 text-2xl uppercase tracking-wider text-[#3ee04f]`}>
            Team Hub
          </p>
          <p className="mx-auto mt-4 inline-block rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-100">
            {CLUB.kitSeason} season
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {TEAMS.map((t) => (
              <span
                key={t.slug}
                className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white ring-1 ring-white/20"
              >
                {t.accent} {t.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 w-full max-w-2xl flex-1 px-5 pb-10">
        {/* Players' study app: tactics guide, quizzes, skill challenges */}
        <a
          href="/training-hub"
          className="group block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="relative">
            <PitchPicture />
            <span className="absolute left-4 top-4 rounded-full bg-[#f9a825] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#1a2e05] shadow">
              For players
            </span>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-extrabold text-gray-900">Player Training Hub</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Learn how we play, test yourself and level up your game between sessions.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">📋 Tactical guide</span>
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-800">🧠 Quiz</span>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-800">🎯 Skill challenges</span>
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-purple-800">📍 Positions</span>
            </div>
            <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e65100] to-[#f9a825] py-3 font-bold text-white shadow-sm transition-opacity group-hover:opacity-90">
              Start Training
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </div>
        </a>

        {/* Kit sizes for parents */}
        <Link
          href="/kit"
          className="group relative mt-5 block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="relative aspect-[1024/557] w-full bg-[#0b1a0c]">
            <Image
              src="/kit-generic.jpg"
              alt={`The ${CLUB.kitSeason} home and away kits`}
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-cover"
            />
            <span className="absolute left-4 top-4 rounded-full bg-[#3ee04f] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#060906] shadow">
              New for {CLUB.kitSeason}
            </span>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-extrabold text-gray-900">Kit Sizes</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Tell us your child&apos;s shirt, shorts and socks size for the new kit. It takes a
              minute, and there&apos;s a size guide to help.
            </p>
            <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-bold text-white shadow-sm transition-colors group-hover:bg-green-700">
              Choose Kit Size
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </div>
        </Link>

        {CLUB.publicResults && (
          <Link
            href="/results"
            className="group mt-4 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-green-400 hover:shadow-md"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-50 text-2xl">⚽</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-gray-900">Results</span>
              <span className="block text-sm text-gray-500">
                Scores, league tables and top scorers for every team.
              </span>
            </span>
            <span className="text-green-700 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        )}

        {/* Coaches */}
        <Link
          href="/admin"
          className="group mt-5 block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="relative overflow-hidden bg-[#060906] px-5 pb-5 pt-12">
            <Image
              src="/poster/brush-background.jpg"
              alt=""
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-cover object-center opacity-60"
            />
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-gray-900 shadow">
              🔒 Coaches only
            </span>
            <div className="relative grid grid-cols-2 gap-2">
              {[
                ["⚽", "Match Log"],
                ["🏃", "Training Log"],
                ["🌟", "Player of the Month"],
                ["📊", "Stats Tracker"],
              ].map(([icon, label]) => (
                <span
                  key={label}
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur-sm"
                >
                  <span className="text-lg">{icon}</span>
                  <span className="min-w-0 leading-tight">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-extrabold text-gray-900">Coach Admin</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Matches, training plans, stats, posters and kit responses — everything for running
              the teams, behind the coaches&apos; password.
            </p>
            <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 font-bold text-white shadow-sm transition-colors group-hover:bg-black">
              Open Coach Admin
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </div>
        </Link>

        {/* Team managers' subs and spending, behind each team's own password */}
        <a
          href="/finance"
          className="group mt-5 block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="relative flex items-center gap-4 overflow-hidden bg-gradient-to-b from-[#1f8f45] to-[#0b3d1d] px-5 pb-5 pt-14">
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-gray-900 shadow">
              🔒 Finance managers only
            </span>
            <Image
              src="/finance/icon-192.png"
              alt=""
              width={96}
              height={96}
              className="h-20 w-20 shrink-0 rounded-2xl shadow-lg ring-2 ring-white/20 sm:h-24 sm:w-24"
            />
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              {[
                ["💷", "Monthly Subs"],
                ["👥", "Players"],
                ["🧾", "Expenses"],
                ["🔔", "Reminders"],
              ].map(([icon, label]) => (
                <span
                  key={label}
                  className="flex min-w-0 flex-col items-center gap-0.5 rounded-xl bg-white/10 px-1 py-2 text-center text-xs font-bold text-white ring-1 ring-white/20"
                >
                  <span className="text-lg leading-none">{icon}</span>
                  <span className="leading-tight">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-extrabold text-gray-900">Financial Admin</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Subs, who&apos;s paid and the team&apos;s spending — each team locked with its own
              password.
            </p>
            <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f7a3d] py-3 font-bold text-white shadow-sm transition-colors group-hover:bg-[#0b3d1d]">
              Open Financial Admin
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </div>
        </a>
      </main>

      <footer className="bg-[#060906] px-6 py-8 text-center">
        <p className={`${display.className} text-lg uppercase tracking-wide text-[#3ee04f]`}>
          {CLUB.slogan}
        </p>
        <p className="mt-2 text-sm text-gray-400">{CLUB.fullName}</p>
      </footer>
    </div>
  );
}

// A pitch in the Training Hub's own style: our players in green, the
// opposition in red, amber arrows for the movement.
function PitchPicture() {
  const line = "rgba(255,255,255,0.85)";
  const us = [
    [120, 150, "GK"],
    [245, 112, ""],
    [245, 188, ""],
    [345, 60, ""],
    [345, 150, ""],
    [345, 240, ""],
    [470, 150, ""],
  ] as const;
  const them = [
    [420, 95],
    [415, 205],
    [560, 150],
  ] as const;
  return (
    <svg viewBox="0 0 672 300" className="block h-auto w-full" role="img" aria-label="A pitch diagram from the Training Hub">
      <defs>
        <marker id="pitch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#f9a825" />
        </marker>
      </defs>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={i * 84} y="0" width="84" height="300" fill={i % 2 ? "#2f8f40" : "#2a8139"} />
      ))}
      <g fill="none" stroke={line} strokeWidth="3">
        <rect x="24" y="20" width="624" height="260" rx="2" />
        <line x1="336" y1="20" x2="336" y2="280" />
        <circle cx="336" cy="150" r="42" />
        <rect x="24" y="85" width="80" height="130" />
        <rect x="568" y="85" width="80" height="130" />
      </g>
      <g fill="none" stroke="#f9a825" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 8">
        <path d="M345 60 Q 430 40 500 70" markerEnd="url(#pitch-arrow)" />
        <path d="M345 240 Q 430 262 500 230" markerEnd="url(#pitch-arrow)" />
        <path d="M470 150 L 540 120" markerEnd="url(#pitch-arrow)" />
      </g>
      {them.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="18" fill="#d32f2f" stroke="white" strokeWidth="4" />
      ))}
      {us.map(([x, y, label]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="20" fill={label ? "#f9a825" : "#14532d"} stroke="white" strokeWidth="4" />
          {label && (
            <text x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#1a2e05">
              {label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
