// What Search finds without asking the server: the app's pages and settings,
// each with the everyday words someone might type for it ("dark mode",
// "training times"). Who can see each, and which part of the hub it needs, so
// nobody is shown a tool that isn't theirs. Safe to use in the browser.
import type { Feature } from "./clubSettings";

export type Audience = "all" | "signedIn" | "coach" | "finance";

export type PageEntry = {
  title: string;
  /** where it lives, shown under the title */
  where: string;
  href: string;
  /** other words for it */
  words: string;
  who: Audience;
  feature?: Feature;
  /** a plain page outside the app's own routes (a full page load) */
  external?: boolean;
};

export const PAGES: PageEntry[] = [
  // everyone
  { title: "Home", where: "Page", href: "/", words: "start main dashboard up next last result", who: "all" },
  { title: "Training Hub", where: "Page", href: "/training-hub", words: "tactics quiz skills challenges how we play players", who: "all", feature: "trainingHub", external: true },
  { title: "Kit Sizes", where: "Kit", href: "/kit", words: "kit shirt shorts socks size form order", who: "all", feature: "kitSizes" },
  { title: "Request Kit", where: "Kit", href: "/kit/request", words: "ask kit new shirt lost jacket rain coat replacement order", who: "all", feature: "kitSizes" },
  { title: "Results", where: "Page", href: "/results", words: "scores league table top scorers fixtures", who: "all" },
  { title: "Sign In", where: "Account", href: "/signin", words: "log in login email passkey", who: "all" },
  { title: "Privacy Policy", where: "Legal", href: "/privacy", words: "gdpr data information", who: "all" },
  { title: "Terms of Use", where: "Legal", href: "/terms", words: "rules legal", who: "all" },

  // anyone signed in: Your Account's screens
  { title: "Your Account", where: "Account", href: "/account", words: "profile me settings", who: "signedIn" },
  { title: "Your Details", where: "Your Account", href: "/account#details", words: "name email change", who: "signedIn" },
  { title: "Profile Photo", where: "Your Account", href: "/account", words: "picture avatar photo", who: "signedIn" },
  { title: "Your Children / Team", where: "Your Account", href: "/account#here", words: "child children kids add team", who: "signedIn" },
  { title: "Your Clubs", where: "Your Account", href: "/account#clubs", words: "clubs switch other club", who: "signedIn" },
  { title: "Sign-In & Security", where: "Your Account", href: "/account#security", words: "passkey face id password security", who: "signedIn" },
  { title: "Appearance", where: "Your Account", href: "/account#appearance", words: "dark mode light theme wallpaper background colour", who: "signedIn" },
  { title: "Tab Bar", where: "Your Account", href: "/account#tabs", words: "customise bottom bar tabs menu", who: "signedIn" },
  { title: "Notifications", where: "Your Account", href: "/account#alerts", words: "alerts push coach alerts notify", who: "signedIn" },
  { title: "Delete Account", where: "Your Account", href: "/account#delete", words: "remove close account", who: "signedIn" },

  // treasurers
  { title: "Financial Admin", where: "Page", href: "/finance", words: "finances subs money payments owed spending treasurer", who: "finance", feature: "financialAdmin", external: true },

  // coaches
  { title: "Coach Admin", where: "Page", href: "/admin", words: "coach tools admin", who: "coach" },
  { title: "Match Log", where: "Coach Admin", href: "/admin/stats/matches", words: "matches fixtures games goals scorers assists result score add match", who: "coach" },
  { title: "Training Log", where: "Coach Admin", href: "/admin/stats/training", words: "training sessions best trainer cancel no training", who: "coach" },
  { title: "Stats Tracker", where: "Coach Admin", href: "/admin/stats", words: "stats goals assists appearances saves totals csv", who: "coach" },
  { title: "Player of the Month", where: "Coach Admin", href: "/admin/stats/player-of-the-month", words: "potm award poster monthly", who: "coach", feature: "playerOfMonth" },
  { title: "Season Presentation", where: "Coach Admin", href: "/admin/stats/presentation", words: "end of season awards presentation night", who: "coach" },
  { title: "Training Plans", where: "Coach Admin", href: "/admin/training/plans", words: "plans drills sessions library weeks", who: "coach", feature: "trainingPlans" },
  { title: "Drill Library", where: "Training Plans", href: "/admin/training/plans?view=library", words: "drills warm up technical game exercises", who: "coach", feature: "trainingPlans" },
  { title: "Camera Register", where: "Coach Admin", href: "/admin/camera", words: "camera filming footage veo upload", who: "coach", feature: "cameraRegister" },
  { title: "Kit Responses", where: "Coach Admin", href: "/admin/kit", words: "kit sizes responses requests csv order still to send", who: "coach", feature: "kitSizes" },
  { title: "Members", where: "Coach Admin", href: "/admin/members", words: "members join requests approve roles coach treasurer admin parents guardians players squad add player move team medical emergency phone", who: "coach" },
  { title: "Help", where: "Coach Admin", href: "/admin/help", words: "help guide manual how to", who: "coach" },
  { title: "Club Settings", where: "Coach Admin", href: "/admin/settings", words: "settings club", who: "coach" },
  { title: "Club Details", where: "Settings", href: "/admin/settings#details", words: "club name initials slogan season", who: "coach" },
  { title: "Club Colour", where: "Settings", href: "/admin/settings#colour", words: "colour color theme brand", who: "coach" },
  { title: "Club Crest", where: "Settings", href: "/admin/settings#crest", words: "crest badge logo icon background", who: "coach" },
  { title: "Kit Picture & Items", where: "Settings", href: "/admin/settings#kit", words: "kit picture image jacket rain coat long sleeve items", who: "coach" },
  { title: "Teams", where: "Settings", href: "/admin/settings#teams", words: "teams add team archive training days times fa full-time code opponents", who: "coach" },
  { title: "Training Days & Times", where: "Settings → Teams", href: "/admin/settings#teams", words: "training day time schedule when monday tuesday wednesday thursday friday", who: "coach" },
  { title: "Parts of the Hub", where: "Settings", href: "/admin/settings#parts", words: "features switch off results for parents training hub kit finance", who: "coach" },
  { title: "Share Your Hub", where: "Settings", href: "/admin/settings#share", words: "share link qr code invite parents", who: "coach" },
];

/** Help's sections, by their # on the Help page (app/components/HelpManual.tsx). */
export const HELP_SECTIONS: { id: string; title: string; words: string }[] = [
  { id: "getting-started", title: "Getting Started", words: "start setup first" },
  { id: "parents", title: "For Parents", words: "parents share" },
  { id: "match-log", title: "Match Log", words: "matches goals" },
  { id: "training-log", title: "Training Log", words: "best trainer sessions" },
  { id: "training-plans", title: "Training Plans", words: "drills plans" },
  { id: "stats-tracker", title: "Stats Tracker", words: "stats" },
  { id: "player-of-the-month", title: "Player of the Month", words: "potm" },
  { id: "camera-and-kit", title: "Camera Register and Kit Responses", words: "camera kit requests" },
  { id: "subs", title: "Financial Admin", words: "subs finance money" },
  { id: "settings", title: "Settings", words: "settings" },
  { id: "end-of-season", title: "End of Season", words: "archive new season reset" },
  { id: "coachs-week", title: "A Coach's Week", words: "weekly checklist" },
  { id: "questions", title: "Questions and Fixes", words: "problems faq troubleshooting" },
];

/** Lower case, without accents or punctuation, for matching. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ");

/** How well `text` matches the words of `query` (0: not at all); every word must appear. */
export function score(query: string, title: string, extra = ""): number {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const t = fold(title);
  const all = `${t} ${fold(extra)}`;
  if (!words.every((w) => all.includes(w))) return 0;
  // the title starting with it, then a word of the title starting with it, then anywhere
  let s = 1;
  if (t.startsWith(words[0])) s += 3;
  else if (words.every((w) => t.split(" ").some((x) => x.startsWith(w)))) s += 2;
  else if (words.every((w) => t.includes(w))) s += 1;
  return s;
}
