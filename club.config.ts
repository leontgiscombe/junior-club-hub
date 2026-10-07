// Everything that makes the hub one club's rather than another's. The rest of
// the app reads the club's name, crest, colours-in-words, teams and FA
// Full-Time details from here, so setting the hub up for a club starts with
// this file (and the crest image in public/).
//
// Built-in drills and a season plan, if a club has the rights to any, go in
// drill-pack/ — see drill-pack/README.md.

export const CLUB = {
  /** Short name, used in page titles and headers — "Your Club – Team Hub". */
  name: "Your Club",
  /** Initials, for tight spaces like the player of the month poster — "YC U10s Lions". */
  initials: "YC",
  /** Full name, used in footers and descriptions. */
  fullName: "Your Club FC",
  /** The club's motto, shown in footers and on posters. */
  slogan: "Play fair, work hard, have fun!",
  /** The crest image in public/, its alt text and its size. */
  crest: {
    src: "/club-crest.png",
    alt: "Club crest",
    width: 240,
    height: 260, // the image's size in pixels
  },
  /**
   * Whether parents can see the public Results page (scores, tables, top
   * scorers). Turn it off for non-competitive football: the card leaves the
   * home page and /results goes back to the hub. Coaches still log every game
   * in Coach Admin as normal.
   */
  publicResults: true as boolean,
  /** The season the kit-size forms are collecting sizes for. */
  kitSeason: "2026/27",
  /**
   * Prefix for Financial Admin's stored data and for what the hub remembers in
   * each browser (a coach's team, when fixtures last synced). Set it once and
   * don't change it afterwards: anything saved under the old prefix is left
   * behind.
   */
  storagePrefix: "club",
  /**
   * How the club's own teams start on FA Full-Time, to tell them apart from
   * the opposition in fixture lists (matched ignoring case).
   */
  faClubName: "Your Club",
} as const;

// The teams. Each gets its own kit form, stats, match log, training log,
// training plan and subs; add or remove one here and every page picks it up.
//   slug        – used in links and stored data; don't change it once in use
//   faSnippet   – the team's Full-Time code snippet (the number in
//                 `var lrcode = '…'`, from Full-Time admin → Media → Code
//                 Snippets → team fixtures); leave out to skip fixture syncing
//   squadName   – how the team is named on posters, after the club's initials
//                 ("YC U10s Lions"); the team's name is used if left out
//   opponents   – the league's other teams, so fixtures can be picked from a
//                 list (exactly as Full-Time names them); leave out for a
//                 free-text opponent box
export type TeamConfig = {
  slug: string;
  name: string;
  accent: string;
  squadName?: string;
  faSnippet?: string;
  opponents?: readonly string[];
};

export const TEAMS: readonly TeamConfig[] = [
  {
    slug: "lions",
    name: "Lions",
    accent: "🦁",
    squadName: "U10s Lions",
  },
  {
    slug: "tigers",
    name: "Tigers",
    accent: "🐯",
    squadName: "U10s Tigers",
  },
];
