// The parts of a game's page that families and coaches both see: the
// scoreboard at the top, and when, where and the coaches' message.
import type { Match } from "@/lib/matchStorage";
import { outcome } from "@/lib/record";
import { dayWords, gameTitle, kindLabel, relativeDay } from "@/lib/fixtureFormat";
import VenueMap from "./VenueMap";

export const card = "rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
export const sub = "text-gray-500 dark:text-gray-400";
export const heading = "px-1 text-[13px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";

const RESULT = {
  W: { label: "Won", tone: "bg-green-600" },
  D: { label: "Drew", tone: "bg-amber-500" },
  L: { label: "Lost", tone: "bg-red-600" },
} as const;

/** The top of the page: who's playing whom, and the kick-off or the score. */
export function GameHero({ match, teamName, today }: { match: Match; teamName: string; today: string }) {
  const played = match.resultLogged && !match.calledOff && match.kind !== "tournament";
  const tournament = match.kind === "tournament";
  const left = match.home || tournament || match.kind === "training" ? teamName : match.opponent;
  const right = match.home || match.kind === "training" ? match.opponent : teamName;
  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-green-700 to-emerald-900 text-white shadow-sm">
      <p className="px-5 pt-4 text-xs font-bold uppercase tracking-wider text-white/75">{kindLabel(match)}</p>
      {tournament ? (
        <div className="px-5 pb-5 pt-2">
          <p className="text-2xl font-extrabold leading-tight">{gameTitle(match)}</p>
          <p className="mt-1 text-sm font-semibold text-white/80">
            {teamName}
            {match.time ? ` · starts ${match.time}` : ""}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pb-5 pt-3">
          <span className="text-left text-lg font-extrabold leading-tight">{left}</span>
          {played ? (
            <span className="rounded-2xl bg-white/15 px-3 py-1.5 text-3xl font-black tabular-nums">
              {match.home ? match.goals.length : match.opponentGoals}–{match.home ? match.opponentGoals : match.goals.length}
            </span>
          ) : (
            <span className="rounded-2xl bg-white/15 px-3 py-2 text-center text-sm font-black">{match.time || "TBC"}</span>
          )}
          <span className="text-right text-lg font-extrabold leading-tight">{right}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 bg-black/15 px-5 py-2.5 text-sm font-semibold">
        <span>{relativeDay(match.date, today)}</span>
        {played && <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${RESULT[outcome(match)].tone}`}>{RESULT[outcome(match)].label}</span>}
      </div>
    </section>
  );
}

export function CalledOff({ match }: { match: Match }) {
  if (!match.calledOff) return null;
  return (
    <div className="rounded-3xl bg-red-50 px-4 py-3.5 text-red-800 dark:bg-red-400/10 dark:text-red-300">
      <p className="font-bold">{match.calledOff === "postponed" ? "This game has been postponed" : "This game has been cancelled"}</p>
      <p className="text-sm opacity-80">{match.calledOff === "postponed" ? "It'll show here again once it has a new date." : "There's nothing to get to."}</p>
    </div>
  );
}

function TimeRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className={`flex-1 text-sm ${sub}`}>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

/** When, where, and the coaches' message. */
export function GameDetails({ match, teamName }: { match: Match; teamName: string }) {
  const notes = match.notes.trim();
  const long = notes.length > 220 || notes.split("\n").length > 4;
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className={heading}>When</h2>
        <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
          <TimeRow label="Date" value={dayWords(match.date, { weekday: "short", day: "numeric", month: "short" })} icon={<><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>} />
          {match.meetTime && <TimeRow label="Meet at" value={match.meetTime} icon={<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4 4 0 0 1 7 0" /></>} />}
          <TimeRow label={match.kind === "tournament" ? "Starts" : "Kick-off"} value={match.time || "TBC"} icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
        </div>
      </section>

      {(match.venue || match.address) && (
        <section className="flex flex-col gap-2">
          <h2 className={heading}>Where</h2>
          <div className={`${card} overflow-hidden`}>
            <VenueMap venue={match.venue} address={match.address} label={`${teamName} ${gameTitle(match)}`} />
          </div>
        </section>
      )}

      {notes && (
        <section className="flex flex-col gap-2">
          <h2 className={heading}>From the coaches</h2>
          <div className={`${card} px-4 py-3.5`}>
            {long ? (
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <p className="line-clamp-4 whitespace-pre-line text-[15px] group-open:hidden">{notes}</p>
                  <span className="mt-1 inline-block text-sm font-bold text-green-700 group-open:hidden dark:text-green-400">Show all</span>
                </summary>
                <p className="whitespace-pre-line text-[15px]">{notes}</p>
              </details>
            ) : (
              <p className="whitespace-pre-line text-[15px]">{notes}</p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

export function Avatar({ name, tone = "gray" }: { name: string; tone?: "green" | "gray" | "dark" }) {
  const colours = {
    green: "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
    dark: "bg-gray-200 text-gray-700 dark:bg-white/15 dark:text-gray-200",
  };
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${colours[tone]}`}>{initials(name) || "?"}</span>;
}
