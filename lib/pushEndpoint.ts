// A browser's push subscription endpoint, checked before the server keeps it
// and later posts to it: only the browsers' own push services, over https,
// never an address on a private network.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.services\.mozilla\.com$/];

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}
