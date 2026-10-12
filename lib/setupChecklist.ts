// "Set up your club": the steps a new club's admin works through, shown on
// Home and Coach Admin until they're done (or the admin hides them). Each
// step ticks itself when it's actually done — the same signals the platform
// admin sees (lib/platformStats.ts) — and the ones a club might not need, or
// that are about checking something, can be ticked by hand. Server only.
import { childrenOf, clubKey, invitesKey, joinAlertsKey, kvCall, peopleKey, type Person } from "./access";
import type { User } from "./auth";
import { financeKeys } from "./financeStorage";
import { keyPrefix } from "./kv";
import { listPasskeys } from "./passkeys";
import { getAllTeamsFor, getClubChanges, getClubFor, getImageInfo } from "./settings";

export type SetupStep = {
  id: string;
  title: string;
  hint: string;
  href: string;
  done: boolean;
  /** one about checking something: the admin can tick it */
  manual?: boolean;
  /** opens a plain page (a full page load) */
  external?: boolean;
};

export const MANUAL_STEPS = ["teams", "parts", "coaches", "share", "finance", "phone"] as const;
const setupKey = (tenant: string) => clubKey(tenant, "setup");
type Stored = { ticked: string[]; hidden: string[] };

async function stored(tenant: string): Promise<Stored> {
  try {
    const raw = await kvCall<string | null>(["GET", setupKey(tenant)]);
    const s = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
    return { ticked: s.ticked ?? [], hidden: s.hidden ?? [] };
  } catch {
    return { ticked: [], hidden: [] };
  }
}

/** Tick (or untick) a step by hand, or hide the card for this admin. */
export async function changeSetup(tenant: string, userId: string, action: "tick" | "untick" | "hide" | "show", step?: string): Promise<void> {
  const s = await stored(tenant);
  if (action === "tick" && step && !s.ticked.includes(step)) s.ticked.push(step);
  if (action === "untick" && step) s.ticked = s.ticked.filter((x) => x !== step);
  if (action === "hide" && !s.hidden.includes(userId)) s.hidden.push(userId);
  if (action === "show") s.hidden = s.hidden.filter((x) => x !== userId);
  await kvCall(["SET", setupKey(tenant), JSON.stringify(s)]);
}

const isStaff = (p: Person) => p.roles.some((r) => r === "admin" || r === "coach");

/**
 * The steps for `person` (a club admin) at `tenant`, or null if the card isn't
 * theirs to see: not an admin, hidden, or everything's done.
 */
export async function setupFor(tenant: string, user: User, person: Person | null): Promise<SetupStep[] | null> {
  if (!person || person.status !== "approved" || !person.roles.includes("admin")) return null;
  const kp = keyPrefix(tenant);
  const [s, crest, changes, club, teams, flat, invites, players, matches, training, alerts, passkeys] = await Promise.all([
    stored(tenant),
    getImageInfo("crest", tenant).catch(() => null),
    getClubChanges(tenant).catch(() => ({}) as Awaited<ReturnType<typeof getClubChanges>>),
    getClubFor(tenant),
    getAllTeamsFor(tenant).catch(() => []),
    kvCall<string[] | null>(["HGETALL", peopleKey(tenant)]).catch(() => null),
    kvCall<number>(["HLEN", invitesKey(tenant)]).catch(() => 0),
    kvCall<number>(["HLEN", `${kp}player_stats`]).catch(() => 0),
    kvCall<number>(["HLEN", `${kp}matches`]).catch(() => 0),
    kvCall<number>(["HLEN", `${kp}training`]).catch(() => 0),
    kvCall<string[] | null>(["HVALS", joinAlertsKey(tenant)]).catch(() => null),
    listPasskeys(user.id).catch(() => []),
  ]);
  if (s.hidden.includes(user.id)) return null;
  const people: Person[] = [];
  for (let i = 0; i + 1 < (flat ?? []).length; i += 2) {
    try {
      people.push(JSON.parse(flat![i + 1]) as Person);
    } catch {}
  }
  const others = people.filter((p) => p.userId !== user.id);
  const live = teams.filter((t) => !t.archived);
  const ticked = (id: string) => s.ticked.includes(id);
  const myAlerts = (alerts ?? []).some((a) => {
    try {
      return (JSON.parse(a) as { userId?: string }).userId === user.id;
    } catch {
      return false;
    }
  });
  const financeReady = club.features.financialAdmin
    ? (await Promise.all(live.map((t) => kvCall<number>(["EXISTS", financeKeys(tenant).auth(t.slug)]).catch(() => 0)))).every((n) => Number(n) > 0)
    : true;

  const steps: SetupStep[] = [
    {
      id: "crest",
      title: "Add your crest and club colour",
      hint: "Your badge becomes the app's icon on everyone's phone.",
      href: "/admin/settings#crest",
      done: !!crest,
    },
    {
      id: "teams",
      title: "Check your teams",
      hint: "Names, age group and match format, and the days each team trains.",
      href: "/admin/settings#teams",
      done: ticked("teams") || (live.length > 0 && live.every((t) => t.format && t.training !== undefined)),
      manual: true,
    },
    {
      id: "parts",
      title: "Choose the parts of the hub you'll use",
      hint: "Switch off anything your club won't need, like Finances or the Camera Register.",
      href: "/admin/settings#parts",
      done: ticked("parts") || !!changes.features,
      manual: true,
    },
    {
      id: "coaches",
      title: "Invite your coaches",
      hint: "They get an email and come straight in, no code or approval needed.",
      href: "/admin/settings#joining",
      // a club with just the one coach ticks it
      done: ticked("coaches") || Number(invites) > 0 || others.some((p) => p.status === "approved" && isStaff(p)),
      manual: true,
    },
    {
      id: "share",
      title: "Share the join link with parents",
      hint: "By WhatsApp or email, or show the QR code at training.",
      href: "/admin/settings#joining",
      done: ticked("share") || others.some((p) => !isStaff(p)),
      manual: true,
    },
    {
      id: "squad",
      title: "Approve parents and get your squad in",
      hint: "Each child a parent adds joins their team's squad once you approve them.",
      href: "/admin/members",
      done: Number(players) > 0 && others.some((p) => p.status === "approved" && childrenOf(p).length > 0),
    },
    {
      id: "first",
      title: "Log your first training session or game",
      hint: "Attendance, scorers and awards build each player's season stats.",
      href: "/admin/stats/training",
      done: Number(matches) + Number(training) > 0,
    },
    ...(club.features.financialAdmin
      ? [
          {
            id: "finance",
            title: "Set up Finances for each team",
            hint: "Give each team its subs password, then add the monthly fee.",
            href: "/finance",
            // a club where only some teams pay subs ticks it
            done: ticked("finance") || financeReady,
            external: true,
            manual: true,
          },
        ]
      : []),
    {
      id: "phone",
      title: "Turn on notifications and Face ID sign-in",
      hint: "Hear straight away when someone asks to join, and sign in with a glance.",
      href: myAlerts ? "/account#security" : "/account#alerts",
      // a phone without Face ID or a fingerprint can't finish this: it can be ticked
      done: ticked("phone") || (myAlerts && passkeys.length > 0),
      manual: true,
    },
  ];
  return steps.every((x) => x.done) ? null : steps;
}
