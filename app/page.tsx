// The home page, laid out like an app's: a short header (your photo, a large
// "Home"), then what matters to whoever is looking —
//   coaches: anyone waiting for approval, the next training and match, the
//            last result, and shortcuts to the coach tools;
//   everyone else signed in to the club: the next training and match for
//            their own (or their children's) team, and the last game's
//            score, to look at only;
//   treasurers who aren't coaches: Financial Admin;
//   parents and players: a reminder to send kit sizes, only while some are
//            still to send (the tab bar has the Training Hub and Kit);
//   signed out: the Training Hub and kit sizes, and a way in for coaches.
// Light or dark (Your Account → Appearance): the page is "themed".
import Link from "next/link";
import { childrenOf, teamsOf } from "@/lib/access";
import { listMatches, type Match } from "@/lib/matchStorage";
import { getSubmissions } from "@/lib/storage";
import { listMembers } from "@/lib/members";
import { currentPerson, listPeople } from "@/lib/people";
import { outcome } from "@/lib/record";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { listTraining, type TrainingSession } from "@/lib/trainingStorage";
import { timesLabel } from "@/lib/clubSettings";
import { SIGNED_OUT, getViewer } from "@/lib/viewer";
import HomeWallpaper from "./components/HomeWallpaper";
import AppHeader from "./components/AppHeader";
import HomeShortcuts, { type ShortcutId } from "./components/HomeShortcuts";
import RefreshOnReturn from "./components/RefreshOnReturn";
import SetupCard from "./components/SetupCard";
import { setupFor } from "@/lib/setupChecklist";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const day = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

const card = "rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
const sub = "text-gray-500 dark:text-gray-400";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** A small app-style icon tile. */
function Tile({ colour, children }: { colour: string; children: React.ReactNode }) {
  return (
    <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white ${colour}`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

const ICON = {
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  stats: <path d="M5 20V10M12 20V4M19 20v-7" />,
  star: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  plans: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>,
  shirt: <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" />,
  money: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  approve: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M19 8v6M16 11h6" /></>,
  coach: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>,
  person: <><circle cx="12" cy="8.5" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

export default async function Home() {
  const tenant = await getTenant();
  const [CLUB, TEAMS, viewer, me] = await Promise.all([
    getClub(),
    getTeams(),
    getViewer(tenant).catch(() => SIGNED_OUT),
    tenant ? currentPerson(tenant).catch(() => null) : null,
  ]);
  const person = me?.person?.status === "approved" ? me.person : null;
  const setup = tenant && me ? await setupFor(tenant, me.user, me.person).catch(() => null) : null;
  const teamName = (slug?: string) => TEAMS.find((t) => t.slug === slug)?.name ?? "";
  const kids = person ? childrenOf(person) : [];
  const isParentView = viewer.signedIn && !viewer.canCoach && !viewer.canFinance;

  // the line under "Home": the club, and whose team this is
  const context = [
    CLUB.name,
    kids.length
      ? kids.map((k) => [k.name.split(" ")[0], teamName(k.team?.slug)].filter(Boolean).join(", ")).join(" · ")
      : teamName(person?.team?.slug),
  ]
    .filter(Boolean)
    .join(" · ");

  // ---- a parent's or player's kit reminder: whose sizes haven't been sent yet ----
  let kitDue: string[] = [];
  if (isParentView && tenant && person && CLUB.features.kitSizes) {
    const who = kids.length
      ? kids.flatMap((k) => (k.team ? [{ name: k.name, team: k.team.slug, playerId: k.playerId }] : []))
      : person.team
        ? [{ name: person.name, team: person.team.slug, playerId: undefined }]
        : [];
    const sent = new Map(
      await Promise.all(
        [...new Set(who.map((w) => w.team))].map(async (t) => [t, await getSubmissions(t).catch(() => [])] as const),
      ),
    );
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    kitDue = who
      .filter((w) => !(sent.get(w.team) ?? []).some((s) => (w.playerId && s.playerId === w.playerId) || same(s.childName, w.name)))
      .map((w) => w.name.split(" ")[0]);
  }

  // ---- what's next, and the coaches' cards ----
  // a parent or player only sees their own (or their children's) team's
  const familyTeams = person ? teamsOf(person) : [];
  const showNext = viewer.canCoach || familyTeams.length > 0;
  let waiting = 0;
  let firstWaiting = "";
  let nextTraining: TrainingSession | null = null;
  let nextMatch: Match | null = null;
  let lastResult: Match | null = null;
  if (showNext && tenant) {
    const myTeams = !viewer.canCoach ? familyTeams : person?.team ? [person.team.slug] : TEAMS.map((t) => t.slug);
    const now = today();
    const [people, members, matches, training] = await Promise.all([
      viewer.canCoach ? listPeople(tenant).catch(() => []) : [],
      viewer.canCoach ? listMembers(tenant).catch(() => []) : [],
      listMatches().catch(() => []),
      listTraining().catch(() => []),
    ]);
    const pending = people.filter((p) => p.status === "pending");
    waiting = pending.length + members.filter((m) => m.status === "pending").length;
    firstWaiting = pending[0]?.name ?? "";
    nextTraining =
      training
        .filter((s) => myTeams.includes(s.team) && !s.cancelled && s.date >= now)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))[0] ?? null;
    const mine = matches.filter((m) => myTeams.includes(m.team));
    nextMatch = mine.filter((m) => !m.resultLogged && m.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    lastResult = mine.filter((m) => m.resultLogged).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }
  const many = viewer.canCoach ? TEAMS.length > 1 && !person?.team : familyTeams.length > 1;


  // the coach tools this person can use, for their shortcuts (they pick which, on the page)
  const available: ShortcutId[] = [
    "matches",
    "training",
    "stats",
    ...(CLUB.features.playerOfMonth ? (["potm"] as const) : []),
    ...(CLUB.features.trainingPlans ? (["plans"] as const) : []),
    ...(CLUB.features.cameraRegister ? (["camera"] as const) : []),
    ...(CLUB.features.kitSizes ? (["kitResponses"] as const) : []),
    "members",
    "settings",
    "help",
    ...(CLUB.publicResults ? (["results"] as const) : []),
    ...(CLUB.features.trainingHub ? (["hub"] as const) : []),
    ...(CLUB.features.kitSizes ? (["kit"] as const) : []),
  ];
  const defaults = available.filter((id) => ["matches", "training", "stats", "potm"].includes(id)).slice(0, 4);

  return (
    <div className="themed wp-page relative isolate min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
      {/* the wallpaper chosen on this phone, if any (Your Account → Appearance) */}
      <HomeWallpaper />
      {/* a fresh copy whenever Home is come back to (e.g. after adding your mobile number) */}
      <RefreshOnReturn />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* header: your photo (Your Account), Search, the club's crest */}
        <AppHeader viewer={viewer} crest={CLUB.crest} />

        <div>
          <h1 className="wp-text text-[34px] font-extrabold leading-tight tracking-tight">Home</h1>
          <p className={`wp-text mt-0.5 text-[15px] ${sub}`}>{context}</p>
        </div>

        {/* anyone in the club without a mobile number yet (it became required): ask for it */}
        {person && me && !me.user.phone && (
          <Link
            href="/account#details"
            className="press flex items-center gap-4 rounded-3xl bg-green-50 px-4 py-3.5 text-green-900 dark:bg-green-400/10 dark:text-green-200"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green-200/70 dark:bg-green-400/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                <path d="M11 18.5h2" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Add your mobile number</span>
              <span className="block text-sm opacity-80">So the club can reach you, e.g. a reminder about subs</span>
            </span>
            <Chevron />
          </Link>
        )}

        {/* a club admin who hasn't finished setting the club up */}
        {setup && <SetupCard steps={setup} />}

        {/* coaches: anyone waiting for approval */}
        {waiting > 0 && (
          <Link
            href="/admin/members"
            className="press flex items-center gap-4 rounded-3xl bg-amber-50 px-4 py-3.5 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-200/70 dark:bg-amber-400/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICON.approve}
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{waiting} waiting for approval</span>
              {firstWaiting && <span className="block truncate text-sm opacity-80">{waiting > 1 ? `${firstWaiting} and ${waiting - 1} more` : firstWaiting}</span>}
            </span>
            <Chevron />
          </Link>
        )}

        {/* what's next: coaches' teams, or a parent's or player's own */}
        {showNext && (
          <section className="flex flex-col gap-2.5">
            <h2 className="wp-text px-1 text-xl font-bold">Up next</h2>
            <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
              {nextTraining && (
                <NextRow link={viewer.canCoach} href="/admin/stats/training">
                  <DateBadge date={nextTraining.date} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{many ? `${teamName(nextTraining.team)} training` : "Training"}</span>
                    <span className={`block text-sm ${sub}`}>
                      {day(nextTraining.date, { weekday: "long", day: "numeric", month: "short" })}
                      {timesLabel(nextTraining) ? ` · ${timesLabel(nextTraining)}` : ""}
                    </span>
                  </span>
                </NextRow>
              )}
              {nextMatch && (
                <NextRow link={viewer.canCoach} href="/admin/stats/matches">
                  <DateBadge date={nextMatch.date} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {many ? `${teamName(nextMatch.team)} ` : ""}vs {nextMatch.opponent || "TBC"}
                    </span>
                    <span className={`block text-sm ${sub}`}>
                      {day(nextMatch.date, { weekday: "long", day: "numeric", month: "short" })}
                      {nextMatch.time ? ` · ${nextMatch.time}` : ""} · {nextMatch.home ? "Home" : "Away"}
                    </span>
                  </span>
                </NextRow>
              )}
              {/* no match entered yet: where coaches add one */}
              {!nextMatch && (
                <NextRow link={viewer.canCoach} href="/admin/stats/matches">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICON.ball}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">No match coming up</span>
                    <span className={`block text-sm ${sub}`}>{viewer.canCoach ? "Add one in the Match Log" : "It'll show here once it's arranged"}</span>
                  </span>
                </NextRow>
              )}
            </div>
          </section>
        )}

        {/* the last result, a long row like Up next's (coaches tap through; parents and players just see the score) */}
        {lastResult && (
          <section className="flex flex-col gap-2.5">
            <h2 className="wp-text px-1 text-xl font-bold">Last result</h2>
            <div className={`${card} overflow-hidden`}>
              <NextRow link={viewer.canCoach} href={CLUB.publicResults ? "/results" : "/admin/stats/matches"}>
                <span className={`grid h-12 min-w-14 shrink-0 place-items-center rounded-xl px-2 text-xl font-extrabold text-white ${RESULT[outcome(lastResult)].badge}`}>
                  {lastResult.goals.length}–{lastResult.opponentGoals}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {many ? `${teamName(lastResult.team)} ` : ""}vs {lastResult.opponent || "TBC"}
                  </span>
                  <span className={`block text-sm ${sub}`}>
                    <span className={`font-bold ${RESULT[outcome(lastResult)].text}`}>{RESULT[outcome(lastResult)].label}</span>
                    {" · "}
                    {day(lastResult.date, { weekday: "long", day: "numeric", month: "short" })}
                  </span>
                </span>
              </NextRow>
            </div>
          </section>
        )}

        {/* treasurers and club admins: the subs, a long row like Up next's */}
        {viewer.canFinance && CLUB.features.financialAdmin && (
          <a href="/finance" className={`press ${card} flex items-center gap-4 px-4 py-3.5`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICON.money}
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Finances</span>
              <span className={`block text-sm ${sub}`}>Subs and spending</span>
            </span>
            <Chevron />
          </a>
        )}

        {/* coaches: shortcuts to the tools */}
        {viewer.canCoach && <HomeShortcuts available={available} defaults={defaults} />}

        {/* signed out: the Training Hub and kit sizes (signed in, they're on the tab bar);
            parents and players: a kit reminder while sizes are still to send */}
        {(isParentView || !viewer.signedIn) && (
          <>
            {CLUB.features.trainingHub && !viewer.signedIn && (
              <a href="/training-hub" className={`press ${card} block overflow-hidden`}>
                <Pitch />
                <span className="block px-5 pb-5 pt-4">
                  <span className="block text-xl font-extrabold">Training Hub</span>
                  <span className={`mt-1 block text-[15px] ${sub}`}>Learn how we play, test yourself with quizzes and take on skill challenges.</span>
                </span>
              </a>
            )}
            {CLUB.features.kitSizes && (!viewer.signedIn || kitDue.length > 0) && (
              <Link href="/kit" className={`press ${card} flex items-center gap-4 p-4`}>
                <Tile colour="bg-orange-700">{ICON.shirt}</Tile>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold">Kit Sizes</span>
                  <span className={`block text-sm ${sub}`}>
                    {!viewer.signedIn
                      ? "Send your child's sizes for the new kit"
                      : kids.length
                        ? `Send ${kitDue.join(" and ")}'s sizes for the new kit`
                        : "Send your sizes for the new kit"}
                  </span>
                </span>
                <Chevron />
              </Link>
            )}
          </>
        )}

        {/* signed out: the way in for coaches and treasurers */}
        {!viewer.signedIn && (
          <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
            <Link href="/signin" className="press flex items-center gap-4 px-4 py-3.5">
              <Tile colour="bg-gray-700">{ICON.person}</Tile>
              <span className="flex-1">
                <span className="block font-bold">Sign In</span>
                <span className={`block text-sm ${sub}`}>With the email the club knows you by</span>
              </span>
              <Chevron />
            </Link>
            <Link href="/admin" className="press flex items-center gap-4 px-4 py-3.5">
              <Tile colour="bg-gray-900 dark:bg-gray-700">{ICON.coach}</Tile>
              <span className="flex-1">
                <span className="block font-bold">Coach Admin</span>
                <span className={`block text-sm ${sub}`}>With the coaches&apos; password</span>
              </span>
              <Chevron />
            </Link>
          </div>
        )}

        <p className={`wp-text text-center text-xs ${sub}`}>
          <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link>
        </p>
      </main>
    </div>
  );
}

/** A calendar-style date: the month small, the day large. */
/** A row under Up next: coaches tap through to the log; everyone else just sees it. */
function NextRow({ link, href, children }: { link: boolean; href: string; children: React.ReactNode }) {
  return link ? (
    <Link href={href} className="press flex items-center gap-4 px-4 py-3.5">
      {children}
      <Chevron />
    </Link>
  ) : (
    <div className="flex items-center gap-4 px-4 py-3.5">{children}</div>
  );
}

/** How a result looks: green for a win, amber for a draw, red for a loss. */
const RESULT = {
  W: { label: "Won", badge: "bg-green-600", text: "text-green-700 dark:text-green-400" },
  D: { label: "Drew", badge: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  L: { label: "Lost", badge: "bg-red-600", text: "text-red-600 dark:text-red-400" },
} as const;

function DateBadge({ date }: { date: string }) {
  return (
    <span className="w-12 shrink-0 rounded-xl bg-green-50 py-1.5 text-center dark:bg-green-400/10">
      <span className="block text-[11px] font-bold uppercase text-green-700 dark:text-green-400">{day(date, { month: "short" })}</span>
      <span className="block text-xl font-extrabold leading-tight">{day(date, { day: "numeric" })}</span>
    </span>
  );
}

/** The Training Hub card's picture: a pitch with the team in shape. */
function Pitch() {
  return (
    <span className="relative block h-36 bg-green-800">
      <svg viewBox="0 0 350 144" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
        {[0, 100, 200, 300].map((x) => (
          <rect key={x} x={x} y="0" width="50" height="144" fill="rgba(255,255,255,0.06)" />
        ))}
        <rect x="14" y="12" width="322" height="120" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <line x1="175" y1="12" x2="175" y2="132" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <circle cx="175" cy="72" r="22" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <circle cx="60" cy="72" r="9" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
        {[
          [120, 44],
          [120, 100],
          [175, 72],
          [212, 38],
          [212, 106],
          [268, 72],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="#14532d" stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <span className="absolute left-4 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-950">
        For players
      </span>
    </span>
  );
}
