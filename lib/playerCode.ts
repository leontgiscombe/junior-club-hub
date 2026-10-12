// What a player's setup QR code or typed code says (lib/playerDevices.ts).
// The QR code is a link to their club's setup page with the code in it:
// https://<club>/player?code=123456. Browser and server alike.

/** The setup link a QR code shows for `code` at the club `origin`. */
export const playerSetupUrl = (origin: string, code: string) => `${origin}/player?code=${code}`;

/**
 * A scanned QR code or typed text: its six-digit code, and — for a link to
 * one of this platform's clubs — that link. Anything else is null, so a QR
 * code from elsewhere is never followed. `root` is the platform's domain
 * (ROOT_DOMAIN, e.g. "example.com"), given by the server; `here` this page's host.
 */
export function readPlayerCode(text: string, here: string, root: string): { code: string; url?: string } | null {
  const t = text.trim();
  if (/^\d{3}\s?\d{3}$/.test(t)) return { code: t.replace(/\D/g, "") };
  try {
    const u = new URL(t);
    const code = (u.searchParams.get("code") ?? "").replace(/\D/g, "");
    const host = u.host.toLowerCase();
    const r = root.toLowerCase();
    const ours = host === here.toLowerCase() || (!!r && (host === r || host.endsWith(`.${r}`)));
    if (!ours || u.pathname !== "/player" || code.length !== 6) return null;
    return { code, url: u.toString() };
  } catch {
    return null;
  }
}
