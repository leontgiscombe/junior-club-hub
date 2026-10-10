// Passkeys in the browser (lib/passkeys.ts on the server): adding one to your
// account, and signing in with one.
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";

export const supportsPasskeys = () => typeof window !== "undefined" && browserSupportsWebAuthn();

/** Whether this browser's person has used or added a passkey (the gch_pk cookie the server sets). */
export const hasPasskeyHint = () => typeof document !== "undefined" && /(?:^|;\s*)gch_pk=1/.test(document.cookie);

/** "No thanks" to adding a passkey, remembered on this device. */
const NO_THANKS = "gch_pk_no_thanks";
export function saidNoThanks(): boolean {
  try {
    return localStorage.getItem(NO_THANKS) === "1";
  } catch {
    return false;
  }
}
export function sayNoThanks() {
  try {
    localStorage.setItem(NO_THANKS, "1");
  } catch {}
}

/** The browser already has a passkey for this account (it refused to make another). */
export const alreadyHasOne = (e: unknown) => e instanceof Error && e.name === "InvalidStateError";

/** e.g. "iPhone · Safari", so you can tell your passkeys apart. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Computer";
  const br = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "browser";
  return `${os} · ${br}`;
}

async function post(body: unknown) {
  const res = await fetch("/api/auth/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

/** The browser's "cancelled" isn't an error worth showing. */
export const cancelled = (e: unknown) => e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");

export async function addPasskey() {
  const optionsJSON = await post({ action: "add-options" });
  const response = await startRegistration({ optionsJSON });
  return (await post({ action: "add", response, label: deviceLabel() })).passkey;
}

/** Signs in; where to go next. */
export async function signInWithPasskey(next: string): Promise<string> {
  const optionsJSON = await post({ action: "signin-options" });
  const response = await startAuthentication({ optionsJSON });
  return (await post({ action: "signin", response, next })).next;
}
