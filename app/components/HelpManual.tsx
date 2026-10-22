"use client";

// The hub's user manual, for coaches using it for the first time. Behind the
// coaches' password like the rest of Coach Admin. Keep this in step when a
// page changes.
import Link from "next/link";
import { backOr } from "@/lib/back";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { TopBar, useScreens } from "./SettingsUI";

const SECTIONS = [
  { id: "getting-started", title: "Getting Started" },
  { id: "iphone-app", title: "The iPhone App" },
  { id: "parents", title: "For Parents" },
  { id: "player-devices", title: "Players' Own Devices" },
  { id: "members", title: "Members and Roles" },
  { id: "account", title: "Your Account and Security" },
  { id: "match-log", title: "Match Log" },
  { id: "training-log", title: "Training Log" },
  { id: "training-plans", title: "Training Plans" },
  { id: "stats-tracker", title: "Stats Tracker" },
  { id: "player-of-the-month", title: "Player of the Month" },
  { id: "season-awards", title: "End of Season Awards" },
  { id: "camera-and-kit", title: "Camera Register and Kit Responses" },
  { id: "subs", title: "Finances" },
  { id: "settings", title: "Settings" },
  { id: "plans", title: "Plans and Subscriptions" },
  { id: "end-of-season", title: "End of Season" },
  { id: "coachs-week", title: "A Coach's Week" },
  { id: "questions", title: "Questions and Fixes" },
];

const HelpTopic = createContext("");

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const topic = useContext(HelpTopic);
  if (topic !== id) return null;
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:bg-[#1c1c1e] dark:border-white/10">
      <h2 className="mb-3 text-lg font-extrabold text-gray-900 dark:text-gray-50">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">{children}</div>
      <a href="#contents" className="mt-4 block text-xs font-semibold text-green-700 hover:text-green-800 dark:text-green-400">
        ↑ Back to contents
      </a>
    </section>
  );
}

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-2 font-bold text-gray-900 dark:text-gray-50">{children}</h3>
);

const Steps = ({ children }: { children: React.ReactNode }) => (
  <ol className="ml-5 list-decimal space-y-1.5 marker:font-bold marker:text-green-700">{children}</ol>
);

const Bullets = ({ children }: { children: React.ReactNode }) => (
  <ul className="ml-5 list-disc space-y-1.5 marker:text-green-600">{children}</ul>
);

const Checklist = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((item) => (
      <li key={item} className="flex gap-2">
        <span className="text-green-600">☐</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-gray-900 dark:text-gray-50">{children}</strong>
);

export default function HelpManual() {
  const { screen, open } = useScreens("/admin/help");
  const selected = SECTIONS.find((section) => section.id === screen);
  const [search, setSearch] = useState("");
  const topics = SECTIONS.filter((section) => section.title.toLowerCase().includes(search.toLowerCase()));
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (pwd: string) => {
    if (!pwd) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-auth?key=${encodeURIComponent(pwd)}`);
      if (res.status === 429) {
        setError("Too many wrong passwords — try again in 15 minutes");
        return;
      }
      if (res.status === 401) {
        setError("Incorrect password");
        return;
      }
      if (!res.ok) throw new Error();
      setAuthed(true);
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      setKey(urlKey);
      Promise.resolve(login(urlKey)).finally(() => setChecking(false));
    } else {
      // signed in with an account, or the coach password given earlier: no password box
      accountKey()
        .then(async (k) => {
          if (k) {
            setKey(k);
            await login(k);
          }
        })
        .finally(() => setChecking(false));
    }
  }, [login]);
  // a coach password that worked here opens every other tool too
  useEffect(() => {
    if (authed) rememberCoachKey(key);
  }, [authed, key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!authed) {
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">❓</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Help</h1>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login(key)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3 dark:text-gray-50 dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center dark:text-red-400">{error}</p>}
          <button
            onClick={() => login(key)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Checking…" : "Open help"}
          </button>
          <Link
            href="/admin" onClick={backOr}
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400"
          >
            ← Coach Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50 pb-12">
      {selected ? <TopBar title={selected.title} onBack={() => open("contents")} /> : <TopBar title="Help" href={`/admin${keyQuery(key)}`} />}

      <HelpTopic.Provider value={selected?.id ?? ""}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        <a hidden={!!selected} href="/support?kind=problem#contact" className="press flex items-center justify-between gap-3 rounded-2xl bg-green-50 px-5 py-4 text-green-900 dark:bg-green-400/10 dark:text-green-200">
          <span>
            <span className="block font-bold">Stuck, or something not working?</span>
            <span className="block text-sm opacity-80">Ask us, report a problem or suggest something</span>
          </span>
          <span aria-hidden="true">→</span>
        </a>
        <nav hidden={!!selected} id="contents" className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:bg-[#1c1c1e] dark:border-white/10">
          <label className="mb-4 block"><span className="sr-only">Search help topics</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search help topics" className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1c1c1e]" /></label>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Contents</p>
          <ol className="ml-5 list-decimal space-y-1 text-[15px]">
            {topics.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="font-medium text-green-700 hover:text-green-800 dark:text-green-400">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
          {!topics.length && <p role="status" className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No matching help topics.</p>}
          <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-400/10 dark:text-green-200">
            <B>The one rule to know:</B> enter things once, in the right place. Games, goals and
            match awards go in the <B>Match Log</B>; each session&apos;s best trainer goes in the{" "}
            <B>Training Log</B>. The stats tracker and player of the month fill in from those two by
            themselves.
          </p>
        </nav>

        <Section id="getting-started" title="Getting Started">
          <p>
            Everyone signs in with their own email: type it, and we email a 6-digit code — there&apos;s
            no password to remember. Then add a <B>passkey</B> (Your Account → Sign-In &amp; Security)
            and you sign in with Face ID or a fingerprint from then on.
          </p>
          <p>
            A new club&apos;s admin sees <B>Set Up Your Club</B> at the top of Home and Coach Admin:
            your crest, your teams, the parts of the hub you&apos;ll use, inviting coaches, getting
            parents to join and logging your first session. Each step ticks itself off once it&apos;s
            done (tap <B>Done</B> on the ones that are just a check), and the card goes when
            they&apos;re all done, or tap <B>Hide</B>.
          </p>
          <H3>Which Email to Use</H3>
          <Bullets>
            <li>Sign in with <B>your own email</B>, not a shared club one. It&apos;s your personal account, not the club&apos;s.</li>
            <li><B>One account does everything</B>: club admin, coach, treasurer and parent at the same club, and more than one club. There&apos;s no need for a second login or to invite yourself.</li>
            <li>Other committee members use <B>their own emails</B>: make them admins in Coach Admin → <B>Members</B>. When someone steps down, take their role away and the club carries on.</li>
            <li>A shared address (secretary@…) is still useful as the club&apos;s <B>contact email</B> in Settings, just not for signing in.</li>
          </Bullets>
          <H3>Finding Your Way Around</H3>
          <Bullets>
            <li>The <B>tab bar</B> at the bottom: Home, Training (the players&apos; Training Hub), Finances (treasurers and club admins), Kit and Coach. Choose your own in Your Account → <B>Tab Bar</B>.</li>
            <li>Your <B>photo or initials</B> at the top left of every main page opens <B>Your Account</B>; the magnifying glass searches the hub.</li>
            <li><B>Home</B> shows what&apos;s next (training and the next match), the last result, Finances for treasurers, and your <B>Shortcuts</B>. Press and hold a card or a shortcut to hide it or add more, then tap <B>Done</B>.</li>
          </Bullets>
          <H3>Getting Into Coach Admin</H3>
          <Steps>
            <li>A club admin invites you from Coach Admin → Settings → <B>Joining the Club</B> (or gives you the Coach role in <B>Members</B>).</li>
            <li>Sign in with that email address. You&apos;re straight in — no code or approval needed.</li>
            <li>Tap <B>Coach</B> on the tab bar. You see a card for each tool.</li>
          </Steps>
          <p>
            The tools are the <B>Match Log</B> (marked <em>Start here</em>), <B>Training Log</B>,{" "}
            <B>Player of the Month</B>, <B>Training Plans</B>, <B>Stats Tracker</B>, <B>Members</B>,{" "}
            <B>Camera Register</B>, <B>Kit Responses</B>, <B>Settings</B> and this <B>Help</B>. Each has a{" "}
            round <B>back arrow</B> at the top left to get back.
          </p>
          <H3>Picking Your Team</H3>
          <p>
            Most pages have a tab for each team at the top.
            Tap your team. Your phone remembers it, so every page opens on your team from then on.
          </p>
        </Section>

        <Section id="iphone-app" title="The iPhone App">
          <p>
            Grassroots Club Hub is on the App Store for iPhone. It&apos;s the same hub as the website: anything changed in one
            shows in the other straight away, and you sign in with the same email.
          </p>
          <H3>Getting Started in the App</H3>
          <Steps>
            <li>Download <B>Grassroots Club Hub</B> from the App Store and open it.</li>
            <li>Already have an account? Tap <B>Already have an account? Sign In</B> and enter your email, then the code we send.</li>
            <li>New here? Tap <B>I&apos;m a Parent or Coach</B> and type your club&apos;s code, or <B>I&apos;m a Player</B> with a code from a parent or coach.</li>
            <li>Running a club that isn&apos;t on the hub yet? Tap <B>Start a New Club</B>. It&apos;s free for 30 days.</li>
          </Steps>
          <H3>More Than One Club</H3>
          <p>
            The app opens on the club you used last. To go to another, sign out (or, on a club&apos;s join page, tap{" "}
            <B>Not … ? Switch Club</B>) and pick it from <B>Your Clubs</B>.
          </p>
          <H3>Face ID</H3>
          <p>
            After your first sign-in the app offers Face ID. Say yes and you won&apos;t need an emailed code on that phone again.
          </p>
        </Section>

        <Section id="parents" title="For Parents">
          <H3>Joining</H3>
          <Steps>
            <li>Open the club&apos;s <B>join link</B> (the club shares it by WhatsApp or email, or as a QR code at training).</li>
            <li>Sign in with your email, then add your name, mobile number and your child (their full name and team).</li>
            <li>A coach approves you. Until then, Home says <B>Waiting for a coach to approve you</B>.</li>
          </Steps>
          <p>
            Once you&apos;re in, Home shows your child&apos;s next training and match. Add another child,
            their photo or their medical notes and emergency contact in Your Account → <B>Your Children</B>;
            only you and the club&apos;s coaches see those.
          </p>
          <H3>Sending a Kit Size</H3>
          <Steps>
            <li>Tap <B>Kit</B> on the tab bar, then your child&apos;s team.</li>
            <li>Choose your child. Not there? Pick <B>My child isn&apos;t listed</B> and type their name.</li>
            <li>Pick a <B>shirt</B>, <B>shorts</B> and <B>socks</B> size. A size guide is on the page.</li>
            <li>Tap <B>Send Sizes</B>. The page shows <B>All done!</B> with the sizes chosen.</li>
            <li>More than one child in the club? Tap <B>Submit Another Child</B>.</li>
          </Steps>
          <p>
            Need something during the season, like new shorts? Kit → <B>Request Kit</B> asks the coaches.
          </p>
          <H3>Player Training Hub, for the Players</H3>
          <p>
            <B>Training</B> on the tab bar opens the players&apos; own app: a tactical guide with pitch
            diagrams, a three-level quiz, weekly skill challenges and position guides. You can also set
            up your child&apos;s own phone or tablet for it, which then opens only the Training Hub.
          </p>
          <H3>Results</H3>
          <p>
            If the club turns them on, <B>Results</B> shows each team&apos;s scores, league table and top
            scorers (add it to your tab bar, or search for it). For non-competitive football it can be
            switched off, and coaches still log every game as normal, so nothing is lost.
          </p>
        </Section>

        <Section id="player-devices" title="Players' Own Devices">
          <p>
            A player can have the <B>Training Hub</B> on their own phone or tablet, with no email or account. The device opens
            only the Training Hub, as them, and keeps their quiz scores and challenges.
          </p>
          <H3>Setting Up a Device</H3>
          <Steps>
            <li>A parent opens Your Account → <B>Your Children</B> and taps their child (a coach can do it from the player&apos;s card in <B>Members</B>).</li>
            <li>Tap <B>Set Up a Device</B>. A 6-digit code appears. It works once, for 10 minutes.</li>
            <li>On the child&apos;s device, open the app or the club&apos;s website, tap <B>I&apos;m a Player</B> and type the code.</li>
          </Steps>
          <p>
            Setting up a device signs any grown-up out of it, so a child never ends up in a parent&apos;s account.
          </p>
          <H3>Signing a Device Out</H3>
          <p>
            The same place lists every device set up for the child. Tap one to sign it out straight away, for example if a
            tablet is lost or handed on. When a player leaves the club, their devices are signed out for you.
          </p>
        </Section>

        <Section id="members" title="Members and Roles">
          <p>
            <B>Members</B> (Coach Admin) is where people join the club and where you decide what each person can do. Parents,
            players and coaches ask to join with the club&apos;s code; nobody sees anything until they&apos;re approved.
          </p>
          <H3>Approving Someone</H3>
          <Steps>
            <li>Home shows how many are <B>waiting for approval</B>. Tap it, or open Members → <B>Waiting for Approval</B>.</li>
            <li>Check you know them: their name, email, phone and who they say they are are shown.</li>
            <li>For a parent, check each child. The hub picks the closest name in the squad; make sure it&apos;s the same child, or choose <B>New to the squad</B>.</li>
            <li>Under <B>Approve as</B>, tick their roles, then tap <B>Approve</B>. Or <B>Decline</B> if you don&apos;t know them.</li>
          </Steps>
          <p>
            Someone who says they&apos;re a coach starts as a parent: only tick <B>Coach</B> if you know them, as it opens Coach Admin.
          </p>
          <H3>What Each Role Can Do</H3>
          <Bullets>
            <li><B>Club admin:</B> everything, including Settings, roles, Plans, removing players and resetting Finances passwords.</li>
            <li><B>Coach:</B> Coach Admin — match and training logs, stats, awards, kit responses and approving parents.</li>
            <li><B>Treasurer:</B> Finances for their team (or every team, with no team set). A club admin sets a treasurer&apos;s team in Members.</li>
            <li><B>Parent:</B> their own children&apos;s team, fixtures, results, kit and photos.</li>
            <li><B>Player:</B> the Training Hub and their own team&apos;s fixtures.</li>
          </Bullets>
          <p>
            Only a club admin can give or take away the admin, coach and treasurer roles, and only a club admin can take a
            player out of the squad (which also removes their medical notes, photo and devices).
          </p>
        </Section>

        <Section id="account" title="Your Account and Security">
          <p>
            Tap your <B>initials</B> or photo at the top left of Home to open Your Account. One account works for every club
            you belong to, whether you&apos;re a parent, a coach or both.
          </p>
          <H3>Signing In</H3>
          <p>
            There are no passwords. Enter your email and we send a 6-digit code (and a link). Each code works once, for 15
            minutes. Use your own email, not a shared club one, so the account stays yours.
          </p>
          <H3>Face ID and Passkeys</H3>
          <p>
            In <B>Sign-In &amp; Security</B>, tap <B>Add a Passkey</B> to sign in with Face ID, your fingerprint or your
            phone&apos;s screen lock. It also opens your team&apos;s Finances without a password if you&apos;re its treasurer.
          </p>
          <H3>Changing Your Email</H3>
          <p>
            In <B>Your Details</B>, change your email. We send a code to the new address to check it&apos;s yours, then your
            account moves to it at every club.
          </p>
          <H3>Deleting Your Account</H3>
          <Steps>
            <li>Open <B>Sign-In &amp; Security</B> and tap <B>Delete Account</B>.</li>
            <li>Type <B>DELETE</B> to confirm.</li>
          </Steps>
          <p>
            It removes your account, passkeys, sign-ins and your place at every club. If you&apos;re a club&apos;s only admin,
            you&apos;re asked to make someone else an admin first, so the club isn&apos;t left without one.
          </p>
        </Section>

        <Section id="match-log" title="Match Log">
          <p>
            The match log is where each game goes in: the fixture, the score, who scored and
            assisted, who played and the two match awards. Everything else reads from it, so start
            here.
          </p>
          <H3>Fixtures Arrive by Themselves</H3>
          <p>
            Each team&apos;s fixtures come from FA Full-Time. When you open your team&apos;s match
            log, the hub checks Full-Time (at most once an hour on each phone), adds new games and
            corrects moved ones. Tap <B>Sync Now</B> to check straight away. The sync never touches
            goals, awards, who played or filming, and never deletes a game. Full-Time doesn&apos;t
            publish scores for the youngest age groups, so you enter those yourself.
          </p>
          <H3>Adding a Game by Hand</H3>
          <p>For friendlies, tournaments, or anything not on Full-Time:</p>
          <Steps>
            <li>Open <B>Fixtures</B> and tap <B>Add a Game</B>.</li>
            <li>Pick the opponent from the list, or <B>Other Team…</B> and type a name.</li>
            <li>Set the date and kick-off, and choose <B>🏠 Home</B> or <B>🚌 Away</B>.</li>
            <li>Choose <B>🏆 League Game</B>, <B>🥇 Cup Game</B> or <B>🤝 Friendly</B>.</li>
            <li>Tap <B>Add Game</B>.</li>
          </Steps>
          <p>
            Cup and friendly games stay out of the league table, but still count towards
            players&apos; season totals and clean sheets.
          </p>
          <H3>Logging a Game After It&apos;s Played</H3>
          <p>Open <B>Results</B>, tap the game to open its details, and fill in what you know. The league table is under <B>Record</B>.</p>
          <Steps>
            <li><B>Goals:</B> pick the scorer and, if there was one, the assist, then tap <B>Add Goal</B>. ✕ removes a goal.</li>
            <li><B>Opponent&apos;s goals:</B> use the opponent&apos;s <B>scored</B> stepper.</li>
            <li><B>Can&apos;t remember who scored?</B> Set our score with our <B>scored</B> stepper; those goals show as <em>Scorer not recorded</em>.</li>
            <li><B>A 0–0:</B> tap <B>✓ Confirm 0–0</B> so it counts.</li>
            <li><B>Awards:</B> pick the <B>Player of the Match</B> and <B>Most Improved</B>.</li>
            <li><B>👟 Who Played:</B> tap each player who took part. Each is one appearance.</li>
          </Steps>
          <p>
            Everything saves as you tap. A game where the opponent didn&apos;t score is marked as a
            clean sheet by itself.
          </p>
          <H3>Changing or Removing a Game</H3>
          <p>
            Tap ✏️ to change the opponent, date, kick-off, venue or game type, then{" "}
            <B>Save Changes</B>; goals and awards stay as they were. ✕ removes the game after you
            confirm.
          </p>
        </Section>

        <Section id="training-log" title="Training Log">
          <p>
            Every training session for the season is already listed, so you never add one; you only
            pick the best trainer. They follow each team&apos;s training days and times, set in{" "}
            <B>Settings → Teams</B> (Monday until you change them). A change applies from that day
            on; sessions already past stay as they were.
          </p>
          <p>
            <B>Upcoming</B> opens on <B>Today</B> or the <B>Next Session</B>. With a training plan, it shows
            that week&apos;s theme and drills; tap a drill to see it in full, and <B>Mark Done</B>{" "}
            once you&apos;ve run it.
          </p>
          <H3>Picking the Best Trainer</H3>
          <Steps>
            <li>Open <B>History</B> and find the session. Older months are folded, showing how many still need an award.</li>
            <li>Pick the player. It saves at once and adds to their <B>Best Trainer</B> total.</li>
            <li>Wrong player? Pick the right one, or <B>— Not Awarded —</B> to clear it.</li>
            <li>The season&apos;s leaders are under <B>Best Trainers</B>.</li>
          </Steps>
          <H3>When Training Is Called Off</H3>
          <p>
            Tap <B>No Training</B> on that session. Any best trainer given is taken back, and the
            training plan moves back one session instead of losing it. <B>Back On</B> undoes it.
          </p>
        </Section>

        <Section id="training-plans" title="Training Plans">
          <p>
            Each team has its own plan: a run of weekly sessions on the team&apos;s training days, each with a theme and three drills
            in order — a <B>warm-up</B>, a <B>technical</B> drill and a <B>game</B>. The drills come
            from one <B>Drill Library</B> every team shares.
          </p>
          <H3>What&apos;s On Next</H3>
          <p>
            <B>Team Plans</B> opens on the plan&apos;s name and how many weeks are done, then the
            <B> next session</B>: its topic and its three drills. Tap a drill to read it in full (setup,
            how it works, coaching points), <B>Swap Drill</B> for another, or tick its circle once it&apos;s done.
          </p>
          <H3>Setting Up the Plan</H3>
          <Steps>
            <li>Tap <B>Edit Plan</B> to name it and pick the session <B>Week 1 is on</B>; each week after lands on the team&apos;s next training session.</li>
            <li>Tap <B>+ Add Week</B>, tap <B>Topic</B> to give it one, then add its warm-up, technical drill and game. The drills on that topic come first.</li>
            <li>Under <B>Season</B>, tap a week to open it: change its topic or drills, move it <B>Earlier</B> or <B>Later</B>, or remove it.</li>
            <li>Tap <B>Save Plan</B>. Nothing is kept until you do.</li>
          </Steps>
          <p>
            If there&apos;s a season plan for the team&apos;s age group, <B>Edit Plan</B> has a button to use it.
          </p>
          <H3>Ticking Drills Off</H3>
          <p>
            Ticks save straight away, here or on the training log. In <B>Season</B>, a week with all
            three done shows a ✓, a past week with some not ticked shows in amber, and the next one is
            ringed in green. Earlier weeks fold away: tap <B>Show earlier weeks</B> to see them.
          </p>
          <H3>The Drill Library</H3>
          <p>
            <B>📚 Drill Library</B> lists every drill, with age, type and topic filters along the top and a
            search. The ages start on the team you&apos;re planning for (U8, U9–11, U12–14, U15–17, U18), or
            tap <B>All Ages</B>. Tap a drill to read it, or to edit it. A drill can have up to three{" "}
            <B>photos or PDFs</B> (Edit → <B>+ Add Photo or PDF</B>), like a photo of the whiteboard
            or a drawn-up session; the first photo shows at the top of the drill.
            Any coach can read it, but only the club owner can add or change drills (with{" "}
            <B>🔒 Owner</B> and their own password).
          </p>
        </Section>

        <Section id="stats-tracker" title="Stats Tracker">
          <p>
            The stats tracker adds up a team&apos;s whole season from the match and training logs.
            Its main jobs are setting up your squad and looking things up.
          </p>
          <H3>First Job of the Season: Add Your Squad</H3>
          <Steps>
            <li>Pick your team, open <B>Players</B> and tap <B>Add Players</B>.</li>
            <li>Type a name and tap <B>Add</B>, or <B>Paste a Squad</B>, one name per line.</li>
            <li>A single saved player opens in their own detail screen.</li>
          </Steps>
          <p>
            Players must be in the squad before they can be picked as scorers or award winners.
          </p>
          <H3>What&apos;s on the Page</H3>
          <Bullets>
            <li><B>Team:</B> the next fixture, league record, clean sheets and squad totals.</li>
            <li><B>Players:</B> search, sort and open an individual player.</li>
            <li><B>Awards:</B> milestones, stats leaders and the parent awards tool.</li>
            <li><B>Season management:</B> CSV exports, presentations, archive and restore.</li>
          </Bullets>
          <H3>Correcting a Number</H3>
          <p>
            Fix it at its source first: the game in the match log or the session in the training
            log. Only if that isn&apos;t possible, open the player, tap <B>Correct Stats</B> and use − and +. Tap <B>Done</B> to lock corrections again.
          </p>
          <H3>Goalkeepers</H3>
          <p>
            In edit mode, tap a player&apos;s <B>👕 Outfield</B> badge to make them a{" "}
            <B>🧤 Goalkeeper</B>; their card then tracks saves instead of goals and assists.
          </p>
        </Section>

        <Section id="player-of-the-month" title="Player of the Month">
          <p>
            The hub works out each team&apos;s player of the month from the awards already logged,
            and makes a <em>Team News</em> poster to share.
          </p>
          <H3>How the Winner Is Picked</H3>
          <p>
            Each best trainer, most improved and player of the match in the month is 1 point. Level
            players are split by more kinds of award, then more player of the match, then the latest
            award. You can always choose someone else.
          </p>
          <H3>Making the Poster</H3>
          <Steps>
            <li>Pick your team. It opens on last month; change it with <B>Month</B>.</li>
            <li>Check the standings; the winner has a ★. Tap another player to choose them instead.</li>
            <li>Optional: <B>+ Add a Photo</B> and slide it to frame their face — only with their parents&apos; permission. The photo stays on your phone.</li>
            <li>Check the <B>Poster Words</B> and change anything you like.</li>
            <li>Tap <B>🖼️ Make the Image</B>, then press and hold it to save, or tap <B>📤 Share</B>.</li>
          </Steps>
          <p>The poster uses first names only, so it&apos;s safe to share.</p>
        </Section>

        <Section id="season-awards" title="End of Season Awards">
          <p>In Coach Admin, open <B>End of Season Awards</B> and choose the team and season.</p>
          <Bullets>
            <li><B>Awards:</B> add a category, or open an award to edit it, open or close voting, or delete it. <B>Add the usual awards</B> adds the common ones in one go (Players&apos; Player, Parents&apos; Player, Manager&apos;s Player, Most Improved, Top Goalscorer, Club Person), each with who votes already set; <B>Copy last season&apos;s awards</B> brings back the names you used before. Both are added with voting closed, and can be renamed or removed.</li>
            <li><B>Results:</B> open an award to see its private standings and weighted vote shares.</li>
            <li><B>Visibility:</B> activate awards for parents only when the team is ready. They stay hidden until activated.</li>
          </Bullets>
          <H3>Who votes</H3>
          <p>Each award has a <B>Who votes</B> setting:</p>
          <Bullets>
            <li><B>Players:</B> every player gets one ballot, which their parent fills in for them — e.g. Players&apos; Player. A player can&apos;t vote for themselves, and if both parents have accounts, the child still has one vote: whoever saves last decides it.</li>
            <li><B>Parents &amp; supporters:</B> each parent account gets its own ballot — e.g. Parents&apos; Player of the Year.</li>
            <li><B>Coaches decide:</B> not on the parents&apos; ballot at all; the coaches pick the winner.</li>
          </Bullets>
          <p>A new award&apos;s setting is picked from its name — anything that isn&apos;t clearly the players&apos; or parents&apos; award starts as <B>Coaches decide</B>, so it stays off the parents&apos; ballot unless you choose otherwise. It can&apos;t be changed once ballots are in. To change it then, delete the award and add it again.</p>
          <p>Activation sends an app notification to eligible parents with phone alerts enabled, never email. Ballots can be updated while voting is open. Parents do not see live results or point values.</p>
        </Section>

        <Section id="camera-and-kit" title="Camera Register and Kit Responses">
          <p>Camera Register has <B>Upcoming</B>, <B>To Upload</B> and <B>Uploaded</B> views. Kit Responses has <B>Sizes</B>, <B>Requests</B> and <B>Waiting</B> views.</p>
          <H3>Camera Register</H3>
          <Steps>
            <li>Open <B>Camera Register</B>; it lists your home games from the match log.</li>
            <li>Pick who has the camera for each game.</li>
            <li>Once the video is uploaded, tick <B>Uploaded to Cloud</B>.</li>
          </Steps>
          <H3>Kit Responses</H3>
          <p>
            Every kit-size form parents have sent, team by team, with a CSV download for the kit
            order. <B>Still to Send</B> lists the squad members (from the Stats tracker) who
            haven&apos;t sent sizes yet, so you know who to chase.
          </p>
          <H3>Kit Requests</H3>
          <p>
            Parents can ask for kit during the season (Kit → <B>Request Kit</B>): the item, size, how
            many and a note. The team&apos;s coaches get an email and, with <B>Coach Alerts</B> on in Your
            Account, a phone alert. Requests show at the top of Kit Responses; tap <B>Mark Done</B> once
            it&apos;s sorted, and the parent sees it as done.
          </p>
        </Section>

        <Section id="subs" title="Finances">
          <p>
            Finances keeps each team&apos;s monthly subs, who has paid, the squad&apos;s parent
            contacts and the team&apos;s spending. Each team&apos;s records are kept apart and stored
            encrypted. A team&apos;s <B>treasurer</B> (Members → their role, with the team they look
            after) and the club&apos;s admins open it with Face ID — no password; anyone else needs
            that team&apos;s own password.
          </p>
          <Steps>
            <li>Tap <B>Finances</B> on Home or the tab bar.</li>
            <li>
              A team that isn&apos;t set up yet shows <B>Set Up</B>: pick a team password (for anyone
              who isn&apos;t its treasurer) and keep the recovery code it gives you somewhere safe.
            </li>
            <li>Tap <B>Open … with Face ID</B> for your team. (A team set up before this needs its password typed once.)</li>
            <li>In <B>Settings</B>, set the monthly fee first.</li>
            <li>
              In <B>Subs</B>, tap <B>Unpaid</B> beside a player when they pay; tap <B>Paid</B> to
              change how they paid or exempt them that month. Tap a name for their card.
            </li>
            <li><B>Who Owes</B> lists anyone behind, with a WhatsApp reminder for each parent; <B>In &amp; Out</B> keeps money in and out, sorted into categories the treasurer can add to, rename or remove (Settings → Categories).</li>
            <li>Tap the <B>padlock</B> at the top when you&apos;ve finished, especially on a shared device.</li>
          </Steps>
          <p>
            Players come from Members by themselves. Treasurers also get <B>Subs</B>, <B>Who Owes</B>,{" "}
            <B>In &amp; Out</B> and <B>Finance Settings</B> shortcuts on Home.
          </p>
        </Section>

        <Section id="settings" title="Settings">
          <p>
            <B>Settings</B> in Coach Admin is where the club&apos;s details live: its name, full
            name, initials, slogan, season and crest, and whether parents can see results. Changes save
            by themselves a moment after you make them (you&apos;ll see <B>Saved ✓</B>), and every page
            shows them straight away.
          </p>
          <Steps>
            <li>Tap <B>Upload Crest</B> and pick the club&apos;s badge. A PNG with a see-through background looks best.</li>
            <li>Fill in any of the boxes. An empty box uses the default shown in it.</li>
            <li>Wait for <B>Saved ✓</B>. The preview at the top shows how the home page will look.</li>
          </Steps>
          <p>
            Phones that already saved the hub to their home screen keep the old icon until it&apos;s
            removed and added again.
          </p>
          <H3>Club Colour</H3>
          <p>
            Under <B>🎨 Club Colour</B>, pick one of the ready-made colours or <B>Your own</B>. The
            Settings page shows it straight away, and once it&apos;s saved every
            page&apos;s buttons, banners and highlights take it. <B>Hub green</B> goes back to the
            original look.
          </p>
          <H3>Parts of the Hub</H3>
          <p>
            Under <B>🧩 Parts of the Hub</B>, switch off anything the club doesn&apos;t use: results
            for parents, the Player Training Hub, Kit Sizes, Finances, Player of the Month,
            Training Plans or the Camera Register. It leaves the home page and Coach Admin, and
            whatever was saved in it stays for when it&apos;s switched back on.
          </p>
          <H3>Joining the Club</H3>
          <p>
            Under <B>Joining the Club</B> is your <B>club code</B>, the join link and a QR code to
            share with parents, players and coaches; whether <B>only approved members</B> can open the
            hub; and <B>Invite by Email</B>, for coaches and helpers to come straight in with the roles
            you choose. People who ask to join wait in <B>Members</B> for you to approve them.
          </p>
          <H3>Sign-In &amp; Passwords</H3>
          <p>
            Under <B>Sign-In &amp; Passwords</B>: switch the shared coach password off once your
            coaches have their own accounts, change the club&apos;s email or coach password, and set up
            or reset a team&apos;s Finances password. If the coach password is ever forgotten, tap{" "}
            <B>Forgot the password?</B> on the Coach Admin sign-in page: a reset link goes to the
            club&apos;s email and works once, for an hour.
          </p>
          <H3>Teams</H3>
          <p>
            Under <B>👥 Teams</B>, tap <B>Edit</B> on a team to change its name, emoji, the name
            used on posters, its FA Full-Time code (so fixtures arrive by themselves) and its league
            opponents. <B>+ Add Team</B> adds one, and the arrows change the order the tabs appear
            in. <B>Archive Team</B> hides a team everywhere but keeps its kit sizes, stats, logs and
            subs; <B>Bring Back</B> restores it. Changes save by themselves; a new team saves once it has a name.
          </p>
        </Section>

        <Section id="plans" title="Plans and Subscriptions">
          <p>
            Every club starts with <B>30 days free</B>, with everything included and no card needed. After that, one
            subscription covers the whole club. Parents, coaches and players never pay.
          </p>
          <H3>The Plans</H3>
          <Bullets>
            <li><B>Starter:</B> up to 3 teams.</li>
            <li><B>Club:</B> up to 10 teams.</li>
            <li><B>Large Club:</B> any number of teams.</li>
          </Bullets>
          <p>
            Every plan has every part of the hub; you pay by how many teams you have. Pay monthly, or yearly and get two
            months free.
          </p>
          <H3>Choosing a Plan</H3>
          <Steps>
            <li>A club admin opens Coach Admin → <B>Settings</B> → <B>Plan</B> (Home also shows a reminder in the last week of the trial).</li>
            <li><B>In the iPhone app:</B> pick a plan and tap <B>Subscribe</B>. Apple takes the payment from your Apple ID.</li>
            <li><B>On the website:</B> tap <B>Subscribe</B> and pay by card or Apple Pay.</li>
          </Steps>
          <p>
            The club opens straight away. Either way works, and the club shows as paid in the app and on the website.
          </p>
          <H3>Changing Plan</H3>
          <p>
            Paid in the app? Open the same <B>Plan</B> screen, pick another plan and tap <B>Switch</B>. A bigger plan starts
            straight away, and Apple credits what&apos;s left of the old one; a smaller plan starts at your next renewal. Paid on
            the website? Use <B>Manage Billing</B> on the Plans page there. Adding more teams than your plan covers asks you
            to move up a plan first.
          </p>
          <H3>Cancelling</H3>
          <Bullets>
            <li><B>Paid in the app:</B> on the iPhone it was bought on, open Settings → your name → <B>Subscriptions</B>.</li>
            <li><B>Paid on the website:</B> Plans → <B>Manage Billing</B>.</li>
          </Bullets>
          <p>
            The plan runs to the end of the month or year you&apos;ve paid for. If a card payment fails, the hub stays open
            while it&apos;s tried again, and Plans asks you to check the card.
          </p>
          <H3>When the Trial or a Plan Ends</H3>
          <p>
            The hub pauses: everyone sees a page saying so, and <B>nothing is deleted</B>. As soon as a club admin chooses a
            plan, it opens again exactly as it was.
          </p>
          <H3>Restore Purchases</H3>
          <p>
            New phone, or reinstalled the app? On the Plan screen, tap <B>Restore Purchases</B> with the same Apple ID you
            subscribed with. A subscription always stays with the club it was bought for.
          </p>
        </Section>

        <Section id="end-of-season" title="End of Season">
          <H3>Presentation Evening</H3>
          <Steps>
            <li>Open the <B>Stats Tracker</B> on the laptop connected to the screen, and pick the team.</li>
            <li>Tap <B>🎬 Presentation</B>, then <B>Start Presentation</B>.</li>
            <li>Use the arrow keys or the on-screen buttons; press <B>F</B> for full screen.</li>
          </Steps>
          <H3>Archiving the Season</H3>
          <p>
            Do this once, after every team&apos;s last game: it covers <B>the whole club</B>. At the
            bottom of the Stats tracker, tap <B>Archive &amp; Reset…</B>, check the new season&apos;s
            name, and confirm. Tallies and match logs reset, squads are kept, and the old season is
            saved under <B>Past Seasons</B>. <B>↩ Restore</B> undoes it.
          </p>
        </Section>

        <Section id="coachs-week" title="A Coach's Week">
          <H3>Start of the Season (Once)</H3>
          <Checklist
            items={[
              "Add your squad in the Stats tracker",
              "Mark any goalkeepers",
              "Open the Match log so your fixtures sync",
              "Set each team's training days and times in Settings → Teams",
              "Set up your Training plan and pick the session week 1 is on",
              "Share the Kit Sizes link with parents",
            ]}
          />
          <H3>Every Training Session</H3>
          <Checklist
            items={[
              "Check tonight's drills in the Training log",
              "Tick Mark done on the drills you ran",
              "Pick the best trainer, or mark No training",
            ]}
          />
          <H3>Every Match Day</H3>
          <Checklist
            items={[
              "Check who is filming the home game",
              "After the game: score, scorers, assists, awards and who played",
              "Tick the upload in the Camera register",
            ]}
          />
          <H3>Start of Each Month</H3>
          <Checklist items={["Make and share last month's Player of the month poster"]} />
        </Section>

        <Section id="questions" title="Questions and Fixes">
          <dl className="space-y-3">
            {[
              ["Coach Admin says you're not a coach", "Ask a club admin to give you the Coach role in Members, using the email you sign in with."],
              ["The sign-in code hasn't come", "Check your junk folder, and that the email address is right; you can ask for another after a minute."],
              ["A page opens on the wrong team", "Tap your team's tab once; your phone remembers it."],
              ["A player isn't in the lists", "Approve their parent's request in Members, or add them in the Stats tracker (Edit)."],
              ["A player's total looks wrong", "Correct the game or session it came from; the total follows."],
              ["A fixture is missing or has moved", "Tap Sync now in the match log, or add it by hand."],
              ["A game shows “no score logged”", "Enter the score, or tap ✓ Confirm 0–0."],
              ["A month is missing from Player of the month", "It only lists months with awards; log them first."],
              ["The poster photo or words have gone", "They're kept on the phone you made them on."],
              ["“That didn't save”", "Usually a weak signal. Wait a moment and try again."],
              ["Can't change a drill", "Only the club owner can edit the drill library."],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold text-gray-900 dark:text-gray-50">{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
      </HelpTopic.Provider>
    </main>
  );
}
