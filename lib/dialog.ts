// The hub's own pop-ups, as a phone app's, instead of the browser's grey
// boxes: a sheet to confirm something, a message, a box to type in, and the
// "Saved" toast. public/app-ui.js draws them (it's on every page, the app's own
// and the two outside it). Browser-only.
type Ui = {
  hubConfirm?: (message: string, opts?: { ok?: string; danger?: boolean }) => Promise<boolean>;
  hubAlert?: (message: string) => Promise<void>;
  hubPrompt?: (message: string, value?: string) => Promise<string | null>;
  hubToast?: (text: string, tone?: "error") => void;
};
const ui = () => window as unknown as Ui;

/** Ask before doing something: true for yes. A message's first paragraph is its title; a "Remove…" question gets a red Remove button. */
export function ask(message: string, opts?: { ok?: string; danger?: boolean }): Promise<boolean> {
  const w = ui();
  return w.hubConfirm ? w.hubConfirm(message, opts) : Promise.resolve(window.confirm(message));
}

/** Tell them something, with an OK. */
export function tell(message: string): Promise<void> {
  const w = ui();
  if (w.hubAlert) return w.hubAlert(message);
  window.alert(message);
  return Promise.resolve();
}

/** Ask for a few words: what's typed, or null if they cancel. */
export function askText(message: string, value = ""): Promise<string | null> {
  const w = ui();
  return w.hubPrompt ? w.hubPrompt(message, value) : Promise.resolve(window.prompt(message, value));
}

/** The small pill at the top: "Saved", or what went wrong (tone "error"). */
export function toast(text: string, tone?: "error") {
  ui().hubToast?.(text, tone);
}
