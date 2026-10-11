// The round back buttons go back to the page you were actually on, like a
// phone app's. Only when there's nowhere in the hub to go back to (the page
// was opened from a link, a notification or the Home Screen) do they go up to
// the page this one belongs to instead. Browser-only.

const MOVED = "hub_moved";

/** Noted on every move between the hub's pages (BackTracker, in the layout). */
export function noteMove() {
  try {
    sessionStorage.setItem(MOVED, "1");
  } catch {}
}

/** Whether there's a hub page to go back to in this tab. */
export function canGoBack(): boolean {
  // the Navigation API knows exactly (newer browsers)
  const nav = (window as unknown as { navigation?: { canGoBack?: unknown } }).navigation;
  if (typeof nav?.canGoBack === "boolean") return nav.canGoBack;
  if (window.history.length < 2) return false;
  try {
    if (sessionStorage.getItem(MOVED)) return true;
  } catch {}
  return document.referrer.startsWith(window.location.origin);
}

/** For a back link's onClick: go back if we can (and skip the link), else let the link go up. */
export function backOr(e: { preventDefault: () => void }) {
  if (!canGoBack()) return;
  e.preventDefault();
  window.history.back();
}
