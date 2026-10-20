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
import { awaitingApproval, childrenOf, teamsOf } from "@/lib/access";
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
import AppHeader from "./components/AppHeader";
import HomeShortcuts, { type ShortcutId } from "./components/HomeShortcuts";
import HomeWidgets from "./components/HomeWidgets";
import { DEVICE_PROMPT_COOKIE, HIDDEN_COOKIE } from "@/lib/homeWidgets";
import DevicePrompt from "./components/DevicePrompt";
import { listPlayerDevices } from "@/lib/playerDevices";
import { cookies } from "next/headers";
import RefreshOnReturn from "./components/RefreshOnReturn";
import SetupCard from "./components/SetupCard";
import { setupFor } from "@/lib/setupChecklist";
import { getTenantRecord } from "@/lib/tenants";
import { billingState } from "@/lib/billing";
import { parentAwardsVisible } from "@/lib/seasonAwardsStorage";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
// the time now, "HH:MM", in the UK
const clockNow = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
const day = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
// "Today", "Tomorrow", or the day and date, for what's coming up
const upcoming = (date: string) => {
  const now = today();
  const tomorrow = new Date(Date.parse(`${now}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return date === now ? "Today" : date === tomorrow ? "Tomorrow" : day(date, { weekday: "long", day: "numeric", month: "short" });
};

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
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M21 10l-5 0M3 10h5M9.5 14.5 7 19M14.5 14.5 17 19" /></>,
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
  // the cards this phone has hidden (HomeWidgets)
  const jar = await cookies();
  const hiddenWidgets = (jar.get(HIDDEN_COOKIE)?.value ?? "").split(".").filter(Boolean);
  const tenant = await getTenant();
  const [CLUB, TEAMS, viewer, me] = await Promise.all([
    getClub(),
    getTeams(),
    getViewer(tenant).catch(() => SIGNED_OUT),
    tenant ? currentPerson(tenant).catch(() => null) : null,
  ]);
  const person = me?.person?.status === "approved" ? me.person : null;
  const setup = tenant && me ? await setupFor(tenant, me.user, me.person).catch(() => null) : null;
  // a club admin, in the last week of the free trial: how long's left (lib/billing.ts)
  const trial =
    tenant && person?.roles.includes("admin")
      ? await getTenantRecord(tenant).then((r) => (r ? billingState(r.billing) : null)).catch(() => null)
      : null;
  const teamName = (slug?: string) => TEAMS.find((t) => t.slug === slug)?.name ?? "";
  const kids = person ? childrenOf(person) : [];
  const showAwards = await parentAwardsVisible(person).catch(() => false);
  const isParentView = viewer.signedIn && !viewer.canCoach && !viewer.canFinance;

  // the line under "Home": the club, and the team(s) Home is showing — no
  // children's names, so they aren't on screenshots or a glance at the phone
  const context = [
    CLUB.name,
    kids.some((k) => !k.pending)
      ? [...new Set(kids.filter((k) => !k.pending).map((k) => teamName(k.team?.slug)).filter(Boolean))].join(" · ")
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

  // ---- a parent's prompt to set up their children's own devices: the ones in
  // the squad with none yet, unless this phone said Not now ----
  let needDevice: { playerId: string; name: string }[] = [];
  if (person && tenant && CLUB.features.trainingHub && jar.get(DEVICE_PROMPT_COOKIE)?.value !== "off") {
    const inSquad = kids.flatMap((k) => (k.playerId && !k.pending ? [{ playerId: k.playerId, name: k.name }] : []));
    const has = await Promise.all(inSquad.map((k) => listPlayerDevices(tenant, k.playerId).then((d) => d.length > 0).catch(() => true)));
    needDevice = inSquad.filter((_, i) => !has[i]);
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
    const clock = clockNow();
    const [people, members, matches, training] = await Promise.all([
      viewer.canCoach ? listPeople(tenant).catch(() => []) : [],
      viewer.canCoach ? listMembers(tenant).catch(() => []) : [],
      listMatches().catch(() => []),
      listTraining().catch(() => []),
    ]);
    // people asking to join, and children approved parents have added since
    const names = awaitingApproval(people);
    waiting = names.length + members.filter((m) => m.status === "pending").length;
    firstWaiting = names[0] ?? "";
    nextTraining =
      training
        // today's is done with once it's finished (or started, with no finish time)
        .filter((s) => myTeams.includes(s.team) && !s.cancelled && s.date >= now && !(s.date === now && (s.end ?? s.start ?? "24:00") <= clock))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))[0] ?? null;
    const mine = matches.filter((m) => myTeams.includes(m.team));
    nextMatch = mine.filter((m) => !m.resultLogged && m.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    lastResult = mine.filter((m) => m.resultLogged).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }
  const many = viewer.canCoach ? TEAMS.length > 1 && !person?.team : familyTeams.length > 1;


  // Finances' tabs, for treasurers and club admins (a treasurer who doesn't coach has just these)
  const finShortcuts: ShortcutId[] = viewer.canFinance && CLUB.features.financialAdmin ? ["finSubs", "finOwes", "finSpending", "finSettings"] : [];
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
    ...finShortcuts,
  ];
  const defaults = available.filter((id) => ["matches", "training", "stats", "potm"].includes(id)).slice(0, 4);

  return (
    <div className="themed wp-page relative isolate min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
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

        {/* signed in, but not in the club yet: join it, or wait for a coach */}
        {me && me.person?.status !== "approved" && (
          <Link
            href="/join"
            className="press flex items-center gap-4 rounded-3xl bg-green-50 px-4 py-3.5 text-green-900 dark:bg-green-400/10 dark:text-green-200"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green-200/70 text-2xl dark:bg-green-400/20" aria-hidden="true">
              {me.person?.status === "pending" ? "⏳" : "👋"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {me.person?.status === "pending" ? "Waiting for a coach to approve you" : `Join ${CLUB.name}`}
              </span>
              <span className="block text-sm opacity-80">
                {me.person?.status === "pending"
                  ? "You'll see your child's team here once they do"
                  : me.person?.status === "declined"
                    ? "A coach didn't approve your request — tap to ask again"
                    : "Add your child, and get the club's updates"}
              </span>
            </span>
            <Chevron />
          </Link>
        )}

        {trial?.kind === "trial" && trial.daysLeft <= 7 && (
          <Link
            href="/plans"
            className="press flex items-center gap-4 rounded-3xl bg-amber-50 px-4 py-3.5 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-200/70 text-2xl dark:bg-amber-400/20" aria-hidden="true">
              ⏳
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {trial.daysLeft} day{trial.daysLeft === 1 ? "" : "s"} left of your free trial
              </span>
              <span className="block text-sm opacity-80">Choose a plan, from £4.99 a month, so the hub carries on</span>
            </span>
            <Chevron />
          </Link>
        )}

        {/* a club admin who hasn't finished setting the club up */}
        {setup && <SetupCard steps={setup} />}

        {showAwards && (
          <Link href="/awards" className={`press ${card} flex items-center gap-4 px-4 py-3.5`}>
            <Tile colour="bg-rose-700">{ICON.star}</Tile>
            <span className="min-w-0 flex-1"><span className="block font-bold">End of Season Awards</span><span className={`block text-sm ${sub}`}>Your team&apos;s awards ballot</span></span>
            <Chevron />
          </Link>
        )}

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

        {/* the cards — next training and match (Up next), the last result, Finances:
            each can be hidden on this phone with a long press (HomeWidgets) */}
        <HomeWidgets
          hidden={hiddenWidgets}
          upNextClass={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}
          widgets={[
            ...(showNext && nextTraining
              ? [{ id: "training" as const, label: "Next training", node: (
                <NextRow link={viewer.canCoach} href="/admin/stats/training">
                  <DateBadge date={nextTraining.date} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{many ? `${teamName(nextTraining.team)} training` : "Training"}</span>
                    <span className={`block text-sm ${sub}`}>
                      {upcoming(nextTraining.date)}
                      {timesLabel(nextTraining) ? ` · ${timesLabel(nextTraining)}` : ""}
                    </span>
                  </span>
                </NextRow>
                ) }]
              : []),
            ...(showNext
              ? [{ id: "match" as const, label: "Next match", node: nextMatch ? (
                <NextRow link={viewer.canCoach} href="/admin/stats/matches">
                  <DateBadge date={nextMatch.date} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {many ? `${teamName(nextMatch.team)} ` : ""}vs {nextMatch.opponent || "TBC"}
                    </span>
                    <span className={`block text-sm ${sub}`}>
                      {upcoming(nextMatch.date)}
                      {nextMatch.time ? ` · ${nextMatch.time}` : ""} · {nextMatch.home ? "Home" : "Away"}
                    </span>
                  </span>
                </NextRow>
                ) : (
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
                ) }]
              : []),
            ...(lastResult
              ? [{ id: "result" as const, label: "Last result", node: (
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
                ) }]
              : []),
            ...(viewer.canFinance && CLUB.features.financialAdmin
              ? [{ id: "finances" as const, label: "Finances", node: (
          <a href="/finance" className={`press ${card} flex items-center gap-4 px-4 py-3.5`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICON.money}
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Finances</span>
              <span className={`block text-sm ${sub}`}>Subs, money in and out</span>
            </span>
            <Chevron />
          </a>
                ) }]
              : []),
          ]}
        />

        {/* parents: set up a child's own device for the Training Hub */}
        {needDevice.length > 0 && <DevicePrompt kids={needDevice} />}

        {/* coaches: shortcuts to the tools */}
        {viewer.canCoach && <HomeShortcuts available={available} defaults={defaults} />}
        {!viewer.canCoach && finShortcuts.length > 0 && <HomeShortcuts available={finShortcuts} defaults={finShortcuts} />}

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
                <span className={`block text-sm ${sub}`}>For coaches: sign in with your email</span>
              </span>
              <Chevron />
            </Link>
          </div>
        )}

        <p className={`wp-text text-center text-xs ${sub}`}>
          <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/support" className="hover:underline">Help</Link>
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
