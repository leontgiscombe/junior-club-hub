// The tab bar's tabs, which each person can choose for themselves (Your
// Account → Tab Bar), kept on their phone. Home is always first; up to
// MAX_TABS in all. public/tabbar.js (the bar on Financial Admin and the
// Training Hub) follows the same rules — keep the two in step. No server-only
// imports: the bar and the picker use it in the browser.

export type TabId =
  | "home"
  | "training"
  | "finances"
  | "kit"
  | "coach"
  | "results"
  | "account"
  | "matches"
  | "trainingLog"
  | "stats"
  | "members"
  | "search";

export type TabContext = {
  signedIn: boolean;
  canCoach: boolean;
  canFinance: boolean;
  features: { trainingHub?: boolean; kitSizes?: boolean; financialAdmin?: boolean };
  publicResults: boolean;
};

export type TabDef = {
  href: string;
  label: string;
  /** a plain page outside the app's own routes (a full page load) */
  external?: boolean;
  /** whether a page belongs to this tab (it's then highlighted) */
  match: (path: string) => boolean;
};

export const TAB_KEY = "hub_tabs";
export const MAX_TABS = 5;
/** Tells the bar to redraw when the choice changes on this phone. */
export const TABS_EVENT = "hub-tabs";

export function tabDef(id: TabId, ctx: TabContext): TabDef {
  switch (id) {
    case "home":
      return { href: "/", label: "Home", match: (p) => p === "/" };
    case "training":
      return { href: "/training-hub", label: "Training", external: true, match: (p) => p === "/training-hub" };
    case "finances":
      return { href: "/finance", label: "Finances", external: true, match: (p) => p === "/finance" };
    case "kit":
      return { href: "/kit", label: "Kit", match: (p) => p === "/kit" };
    case "coach":
      return { href: "/admin", label: "Coach", match: (p) => p === "/admin" };
    case "results":
      return { href: "/results", label: "Results", match: (p) => p === "/results" };
    case "account":
      return ctx.signedIn
        ? { href: "/account", label: "Account", match: (p) => p === "/account" }
        : { href: "/signin", label: "Sign In", match: (p) => p === "/signin" };
    case "matches":
      return { href: "/admin/stats/matches", label: "Match Log", match: (p) => p === "/admin/stats/matches" };
    case "trainingLog":
      return { href: "/admin/stats/training", label: "Training Log", match: (p) => p === "/admin/stats/training" };
    case "stats":
      return { href: "/admin/stats", label: "Stats", match: (p) => p === "/admin/stats" };
    case "members":
      return { href: "/admin/members", label: "Members", match: (p) => p === "/admin/members" };
    case "search":
      return { href: "/search", label: "Search", match: (p) => p === "/search" };
  }
}

/** Every tab this person could have, in the picker's order. */
export function availableTabs(ctx: TabContext): TabId[] {
  const out: TabId[] = ["home"];
  if (ctx.features.trainingHub !== false) out.push("training");
  if (ctx.features.financialAdmin !== false && ctx.canFinance) out.push("finances");
  if (ctx.features.kitSizes !== false) out.push("kit");
  if (ctx.canCoach) out.push("coach");
  if (ctx.publicResults) out.push("results");
  // not Account: your photo, top left of every main page, opens it
  out.push("search");
  if (ctx.canCoach) out.push("matches", "trainingLog", "stats", "members");
  return out;
}

/** The tabs before anyone chooses: the club's main pages, then Coach. */
export function defaultTabs(ctx: TabContext): TabId[] {
  const out: TabId[] = ["home"];
  const can = availableTabs(ctx);
  for (const id of ["training", "finances", "kit", "coach"] as TabId[]) if (can.includes(id)) out.push(id);
  return out.slice(0, MAX_TABS);
}

/** This phone's chosen tabs (Home first, only ones still available), or the defaults. */
export function chosenTabs(ctx: TabContext, saved: unknown): TabId[] {
  if (!Array.isArray(saved)) return defaultTabs(ctx);
  const can = availableTabs(ctx);
  const picked = saved.filter((id): id is TabId => typeof id === "string" && id !== "home" && can.includes(id as TabId));
  return (["home", ...new Set(picked)] as TabId[]).slice(0, MAX_TABS);
}

export function loadSavedTabs(): unknown {
  try {
    return JSON.parse(localStorage.getItem(TAB_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** Save this phone's tabs (the ones after Home); null goes back to the defaults. */
export function saveTabs(tabs: TabId[] | null) {
  try {
    if (tabs) localStorage.setItem(TAB_KEY, JSON.stringify(tabs.filter((t) => t !== "home")));
    else localStorage.removeItem(TAB_KEY);
    window.dispatchEvent(new Event(TABS_EVENT));
  } catch {}
}
