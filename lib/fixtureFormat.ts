// How a fixture's day and times read, the same on the server (alerts) and in
// the browser. No server-only imports.
import type { Match } from "./matchStorage";

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
