// How a fixture's day and times read, the same on the server (alerts) and in
// the browser. No server-only imports.
import type { Match } from "./matchStorage";
import { teamAge, type Team } from "./clubSettings";

/** Today, "YYYY-MM-DD", in the UK. */
export const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** A date ("YYYY-MM-DD") as words, e.g. { weekday: "short", day: "numeric", month: "short" } → "Sat 29 Nov". */
export const dayWords = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/** "Today", "Tomorrow", or "Saturday 29 Nov". */
export function relativeDay(date: string, today = ukToday()): string {
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return date === today ? "Today" : date === tomorrow ? "Tomorrow" : dayWords(date, { weekday: "long", day: "numeric", month: "short" });
}

/** A game in one line, for alerts: "Postponed · Sat 29 Nov · Meet 09:30 · KO 10:00 · Away". */
export function fixtureWhen(m: Pick<Match, "date" | "time" | "meetTime" | "home" | "calledOff">): string {
  return [
    m.calledOff === "postponed" ? "Postponed" : m.calledOff === "cancelled" ? "Cancelled" : "",
    dayWords(m.date, { weekday: "short", day: "numeric", month: "short" }),
    !m.calledOff && m.meetTime ? `Meet ${m.meetTime}` : "",
    !m.calledOff && m.time ? `KO ${m.time}` : "",
    m.home ? "Home" : "Away",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A link that opens Apple Maps at an address (the Maps app, on an iPhone). */
export const appleMapsUrl = (address: string) => `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
/** Apple Maps' directions to an address. */
export const appleDirectionsUrl = (address: string) => `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;

/** What sort of game it is, in words. */
export function kindLabel(m: Pick<Match, "kind" | "home" | "friendly" | "cup">): string {
  if (m.kind === "tournament") return "Tournament";
  if (m.kind === "training") return "Training match";
  return `${m.home ? "Home" : "Away"} · ${m.cup ? "Cup" : m.friendly ? "Friendly" : "League"}`;
}

/** A game's name: "vs Calverley United", or a tournament's own name. */
export const gameTitle = (m: Pick<Match, "kind" | "opponent">) => (m.kind === "tournament" ? m.opponent || "Tournament" : `vs ${m.opponent || "TBC"}`);

/** A reply-by time ("YYYY-MM-DDTHH:MM") in words: "Fri 27 Nov, 18:00". */
export const deadlineWords = (deadline: string) =>
  `${dayWords(deadline.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })}, ${deadline.slice(11, 16)}`;

/**
 * A team's name as it's written on a fixture, like the opposition's: the
 * club, the age group and the team — "Pudsey Juniors U10 Greens". A part the
 * team's own name already has isn't said twice ("U10 Greens", "Pudsey Greens").
 */
export function fixtureTeamName(clubName: string, team: Pick<Team, "name" | "age">): string {
  const name = team.name.trim();
  const age = teamAge(team);
  const hasAge = /\b(u|under)[\s-]?\d{1,2}s?\b/i.test(name);
  const hasClub = !!clubName && name.toLowerCase().includes(clubName.trim().toLowerCase());
  const ageWords = hasAge || !age ? "" : `U${age}`;
  // the club's name already in the team's: the age group goes straight after it
  if (hasClub) {
    const at = name.toLowerCase().indexOf(clubName.trim().toLowerCase()) + clubName.trim().length;
    return ageWords ? `${name.slice(0, at)} ${ageWords}${name.slice(at)}` : name;
  }
  return [clubName.trim(), ageWords, name].filter(Boolean).join(" ");
}
