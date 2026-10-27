// Each member's notifications, behind the bell in the header: everything the
// hub tells them — the alerts it sends to phones (lib/notify.ts), even for
// people who haven't turned phone alerts on, and Player of the Month when a
// coach tells the families — plus their teams' results, worked out from the
// match log when they look (so a score is always the latest, and editing a
// result doesn't tell anyone twice). The red number is how many have come
// since they last opened Notifications. Server only.
import { childrenOf, clubKey, kvCall, type Person } from "./access";
import { rawKv } from "./kv";
import { listMatches, type Match } from "./matchStorage";
import { outcome } from "./record";
import { getClub, getTeams } from "./settings";

export type InboxKind = "join" | "child" | "kit" | "awards" | "approved" | "subs" | "result" | "potm";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  /** when it happened (ISO) */
  at: string;
  title: string;
  body: string;
  /** the page it's about, if there is one */
  url?: string;
};

const KEEP = 50; // the newest kept for each person
const KEEP_DAYS = 180;
const RESULT_DAYS = 30; // results shown for this long after the game
const inboxKey = (tenant: string, userId: string) => clubKey(tenant, `inbox:${userId}`);
const seenKey = (tenant: string, userId: string) => clubKey(tenant, `inbox-seen:${userId}`);

/** Put a notification in each of `userIds`' inboxes, in one trip to the database. Never throws. */
export async function addToInbox(tenant: string, userIds: string[], item: Omit<InboxItem, "id" | "at">): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    const kv = await rawKv();
    if (!kv) return;
    const stored: InboxItem = { id: crypto.randomUUID(), at: new Date().toISOString(), ...item };
    const json = JSON.stringify(stored);
    const p = kv.pipeline();
    for (const id of ids) {
      const key = inboxKey(tenant, id);
      p.lpush(key, json);
      p.ltrim(key, 0, KEEP - 1);
      p.expire(key, KEEP_DAYS * 24 * 3600);
    }
    await p.exec();
  } catch (e) {
    console.error("Notifications not saved:", e);
  }
}

/** The slugs of the teams `person` belongs to: their own, and their children's. */
export function teamsOf(person: Person): Set<string> {
  const teams = new Set<string>();
  if (person.team?.slug) teams.add(person.team.slug);
  for (const child of childrenOf(person)) if (!child.pending && child.team?.slug) teams.add(child.team.slug);
  return teams;
}

/** `date` ("YYYY-MM-DD") at `time` ("HH:MM") in the UK, as a moment. */
function ukTime(date: string, time: string): number {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  if (isNaN(asUtc)) return NaN;
  // the UK's clock at that moment, against UTC's: 0 in winter, an hour in summer
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(asUtc)
    .split(":")
    .map(Number);
  let offset = h * 60 + m - (new Date(asUtc).getUTCHours() * 60 + new Date(asUtc).getUTCMinutes());
  if (offset < -720) offset += 1440;
  if (offset > 720) offset -= 1440;
  return asUtc - offset * 60_000;
}

// A game counts as finished two hours after kick-off (4pm when no time is set),
// so a result being logged goal by goal isn't news until the game's done.
const finishedAt = (m: Match) => ukTime(m.date, m.time || "16:00") + 2 * 3600_000;

/** Results of `person`'s teams' finished games in the last month, as notifications. */
async function resultItems(person: Person): Promise<InboxItem[]> {
  const teams = teamsOf(person);
  if (!teams.size) return [];
  const [matches, allTeams, club] = await Promise.all([listMatches(), getTeams(), getClub()]);
  const now = Date.now();
  const items: InboxItem[] = [];
  for (const m of matches) {
    if (!teams.has(m.team) || !m.resultLogged || m.calledOff) continue;
    const done = finishedAt(m);
    if (!(done <= now) || now - done > RESULT_DAYS * 24 * 3600_000) continue;
    const team = allTeams.find((t) => t.slug === m.team)?.name ?? "We";
    const us = m.goals.length;
    const them = m.opponentGoals;
    const result = outcome(m);
    const line =
      result === "W" ? `${team} beat ${m.opponent} ${us}–${them}.`
        : result === "D" ? `${team} drew ${us}–${them} with ${m.opponent}.`
          : `${team} lost ${us}–${them} to ${m.opponent}.`;
    items.push({
      id: `result:${m.id}`,
      kind: "result",
      at: new Date(done).toISOString(),
      title: `Full time: ${team} ${us}–${them} ${m.opponent}`,
      body: line,
      url: club.publicResults ? `/results?team=${encodeURIComponent(m.team)}` : "/",
    });
  }
  return items;
}

/** `person`'s notifications, newest first, and when they last looked (ISO, or "" if never). */
export async function readInbox(tenant: string, person: Person): Promise<{ items: InboxItem[]; seenAt: string }> {
  if (person.status !== "approved") return { items: [], seenAt: "" };
  const [raw, seenAt, results] = await Promise.all([
    kvCall<string[] | null>(["LRANGE", inboxKey(tenant, person.userId), 0, KEEP - 1]),
    kvCall<string | null>(["GET", seenKey(tenant, person.userId)]),
    resultItems(person).catch(() => [] as InboxItem[]),
  ]);
  const stored: InboxItem[] = [];
  for (const r of raw ?? []) {
    try {
      // the database may hand JSON back already read
      stored.push(typeof r === "string" ? (JSON.parse(r) as InboxItem) : (r as InboxItem));
    } catch {}
  }
  const items = [...stored, ...results].sort((a, b) => b.at.localeCompare(a.at)).slice(0, KEEP);
  return { items, seenAt: typeof seenAt === "string" ? seenAt : "" };
}

/** How many of `items` came after `seenAt`. */
export const unreadCount = (items: InboxItem[], seenAt: string) => items.filter((i) => i.at > seenAt).length;

/** They've opened Notifications: nothing's new any more. */
export async function markInboxSeen(tenant: string, userId: string): Promise<void> {
  await kvCall(["SET", seenKey(tenant, userId), new Date().toISOString(), "EX", KEEP_DAYS * 24 * 3600]);
}
