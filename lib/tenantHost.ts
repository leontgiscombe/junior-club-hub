// Which club a request is for. With ROOT_DOMAIN set (e.g. grassroots-club-hub.co.uk),
// each club lives at its own subdomain — riverside.grassroots-club-hub.co.uk — and the
// root domain itself is the platform's own site (sign up, find your club).
// Without it, or on any other address (a Vercel preview, a club's single
// deployment), the hub runs one club: "default", with its data where a
// single-club hub always kept it.
//
// This file has no server-only imports, so the proxy can use it too.

export const DEFAULT_TENANT = "default";
export const TENANT_ID = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** Web addresses no club can have. */
export const RESERVED = new Set(["www", "app", "api", "admin", "default", "mail", "help", "support", "status", "blog"]);

/**
 * The platform's domain from ROOT_DOMAIN, forgiving the usual slips when it's
 * typed in: "https://", "www.", a path or trailing "/", spaces, capitals.
 */
export const rootDomain = () =>
  (process.env.ROOT_DOMAIN ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .replace(/^\.+|\.+$/g, "");

/**
 * The club for a host name: its id, null for the platform's own site, or the
 * default club when the hub isn't running as a platform.
 */
export function tenantFromHost(hostHeader: string): string | null {
  const root = rootDomain().replace(/:\d+$/, "");
  if (!root) return DEFAULT_TENANT;
  const host = hostHeader.toLowerCase().replace(/:\d+$/, "");
  if (host === root || host === `www.${root}`) return null;
  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -root.length - 1);
    if (TENANT_ID.test(sub) && !RESERVED.has(sub)) return sub;
    return null;
  }
  return DEFAULT_TENANT;
}

/** The platform's own site. */
export function platformUrl(path = "/"): string {
  const root = rootDomain();
  const scheme = /^localhost(:\d+)?$/.test(root) ? "http" : "https";
  return root ? `${scheme}://${root}${path}` : path;
}

/** A club's own web address. */
export function tenantUrl(tenant: string, path = "/"): string {
  const root = rootDomain();
  // http only when trying the platform out on this computer
  const scheme = /^localhost(:\d+)?$/.test(root) ? "http" : "https";
  return root ? `${scheme}://${tenant}.${root}${path}` : path;
}

/** The platform's own name, on its site and sign-up page. */
export const PLATFORM_NAME = process.env.PLATFORM_NAME || "Grassroots Club Hub";
