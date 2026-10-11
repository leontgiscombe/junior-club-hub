// Light or dark (Your Account → Appearance): "system" follows the phone. The
// choice is kept in a cookie on this device, so the page is drawn in it from
// the start; "system" is settled by a tiny script before the page shows
// (THEME_SCRIPT, in the root layout). No server-only imports: the picker uses it too.

export type ThemeChoice = "light" | "dark" | "system";
export const THEME_COOKIE = "hub_theme";
export const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Match My Phone" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const isThemeChoice = (v: unknown): v is ThemeChoice => v === "light" || v === "dark" || v === "system";

/** The phone's status bar and browser bar colours: the pages' background, light or dark. */
export const LIGHT_BAR = "#f2f2f7";
export const DARK_BAR = "#000000";

/** Runs before the page is drawn: sets "dark" on <html> for the saved choice (or the phone's, for "system"). */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(\\w+)/);var t=m?m[1]:"system";var q=matchMedia("(prefers-color-scheme: dark)");var set=function(){var d=t==="dark"||(t==="system"&&q.matches);document.documentElement.classList.toggle("dark",d);var c=d?"${DARK_BAR}":"${LIGHT_BAR}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){if(m.getAttribute("content")!==c)m.setAttribute("content",c)})};set();new MutationObserver(set).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:["content"]});q.addEventListener("change",function(){var n=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(\\w+)/);t=n?n[1]:"system";set()})}catch(e){}})()`;

/** Save a choice on this device and switch to it now. */
export function applyTheme(choice: ThemeChoice) {
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${400 * 24 * 3600}; samesite=lax`;
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? DARK_BAR : LIGHT_BAR));
}

/** The saved choice on this device. */
export function savedTheme(): ThemeChoice {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(\\w+)`));
  return isThemeChoice(m?.[1]) ? m[1] : "system";
}
