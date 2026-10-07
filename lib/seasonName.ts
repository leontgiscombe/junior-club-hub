// The season's name from a date — safe to use in the browser.

/**
 * The default label for a season, e.g. "2026/27". The football season runs
 * roughly August–May, so July onwards counts as the start of the new one.
 */
export function defaultSeasonName(now: Date = new Date()): string {
  const year = now.getFullYear();
  const start = now.getMonth() >= 6 ? year : year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
