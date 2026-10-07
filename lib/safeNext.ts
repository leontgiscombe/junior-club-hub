/** Where to go after signing in: a path on this site only (never another site). */
export const safeNext = (v: unknown) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v.slice(0, 300) : "/";

/**
 * The address a request came to (its scheme and host), for redirects. The
 * server's own idea of its address (req.url) can be its internal one, not the
 * club's, so this reads the Host header the visitor's browser sent.
 */
export function requestBase(req: { headers: Headers; nextUrl: URL }): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}`;
}
