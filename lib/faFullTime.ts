// Fixtures from FA Full-Time (fulltime.thefa.com), the league system our
// divisions run on. Full-Time has no API and its Cloudflare protection blocks
// requests from servers, so the hub can't fetch fixtures itself. What it does
// offer clubs is an official "code snippet": a script that writes a team's
// fixtures into a page, run in the visitor's own browser. The match log loads
// each team's snippet in a hidden frame, reads the fixtures out with
// parseSnippet below, and sends them to the server to add or update
// (syncFaFixtures in lib/matchStorage.ts).
//
// Get a team's snippet from Full-Time admin: Media → Code Snippets → team
// fixtures. Its code is the number in `var lrcode = '…'`.
import { CLUB, TEAMS } from "@/club.config";

/** Each team's Full-Time snippet code (set in club.config.ts). A team without one isn't synced. */
export const FA_SNIPPETS: Record<string, string> = Object.fromEntries(
  TEAMS.flatMap((t) => (t.faSnippet ? [[t.slug, t.faSnippet]] : []))
);

/** How our own teams are named on Full-Time, to tell us apart from the opposition. */
const OUR_CLUB = new RegExp(
  `^${CLUB.faClubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`,
  "i"
);

export interface FaFixture {
  faId: string; // Full-Time's fixture id — how a game is recognised on the next sync
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, "" if not given
  home: boolean;
  opponent: string;
  cup: boolean; // a cup tie rather than a league game
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Sun 06 Sept 2026 09:00" → { date: "2026-09-06", time: "09:00" } */
export function parseFaDate(text: string): { date: string; time: string } | null {
  const m = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/^\w+ (\d{1,2}) ([A-Za-z]+) (\d{4})(?: (\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  if (month < 0) return null;
  const pad = (n: number | string) => String(n).padStart(2, "0");
  return {
    date: `${m[3]}-${pad(month + 1)}-${pad(m[1])}`,
    time: m[4] ? `${pad(m[4])}:${m[5]}` : "",
  };
}

const clean = (el: Element | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * The fixtures in a rendered team-fixtures snippet. The snippet is a table: a
 * full-width row with the date and kick-off, then a row per game — type ("D"
 * for the division, "Cup:" for a cup tie), home side, score, away side, venue —
 * each linking to displayFixture.html?id=….
 *
 * A game listed under another game's date, with no date row of its own, is one
 * Full-Time hasn't dated yet; it's left out (and counted) until it has one.
 */
export function parseSnippet(root: ParentNode): { fixtures: FaFixture[]; undated: number } {
  const fixtures: FaFixture[] = [];
  let undated = 0;
  let current: { date: string; time: string } | null = null;
  let usedHeader = false;
  for (const row of Array.from(root.querySelectorAll("tr"))) {
    const cells = Array.from(row.children).filter((c) => c.tagName === "TD");
    if (cells.length === 1 && cells[0].getAttribute("colspan")) {
      const parsed = parseFaDate(clean(cells[0]));
      if (parsed) {
        current = parsed;
        usedHeader = false;
      }
      continue;
    }
    const link = row.querySelector('a[href*="displayFixture.html?id="]');
    const faId = link?.getAttribute("href")?.match(/id=(\d+)/)?.[1];
    if (!faId || cells.length < 6) continue;
    if (!current || usedHeader) {
      undated++;
      continue;
    }
    usedHeader = true;
    const homeSide = clean(cells[1]);
    const awaySide = clean(cells[5]);
    const home = OUR_CLUB.test(homeSide);
    if (!home && !OUR_CLUB.test(awaySide)) continue;
    fixtures.push({
      faId,
      date: current.date,
      time: current.time,
      home,
      opponent: home ? awaySide : homeSide,
      cup: /cup/i.test(clean(cells[0])),
    });
  }
  return { fixtures, undated };
}
