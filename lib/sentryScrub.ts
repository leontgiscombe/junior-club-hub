// What's sent to Sentry (error reports): only what's needed to find the bug.
// Coach passwords travel in links (?key=…) and children's and parents' details
// in request bodies, so query strings, bodies, cookies and headers are all
// removed, and so is anything after "?" in every address in the report.
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const stripQuery = (url: unknown) => (typeof url === "string" ? url.replace(/[?#].*$/, "") : url);

// anything that looks like an address with a query string, anywhere in a text
const QUERY_IN_TEXT = /((?:https?:\/\/|\/)[^\s"'?#]*)[?#][^\s"']*/g;

/** Every text in `value` (deeply), with query strings taken out of addresses in it. */
function stripQueries<T>(value: T, depth = 0): T {
  if (typeof value === "string") return value.replace(QUERY_IN_TEXT, "$1") as T;
  if (!value || typeof value !== "object" || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => stripQueries(v, depth + 1)) as T;
  for (const [k, v] of Object.entries(value)) (value as Record<string, unknown>)[k] = stripQueries(v, depth + 1);
  return value;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: stripQuery(event.request.url) as string | undefined,
    };
  }
  delete event.user;
  // Next.js copies the address into other places too (request_path, transaction…)
  for (const field of ["contexts", "extra", "tags", "transaction", "message", "exception"] as const) {
    if (event[field]) (event as unknown as Record<string, unknown>)[field] = stripQueries(event[field]);
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => !!b);
  return event;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // console output can hold anything, so it's left out
  if (crumb.category === "console") return null;
  if (crumb.data) {
    for (const k of ["url", "from", "to"]) if (k in crumb.data) crumb.data[k] = stripQuery(crumb.data[k]);
  }
  if (typeof crumb.message === "string") crumb.message = stripQueries(crumb.message);
  return crumb;
}

/** The settings every part of the app (server and browser) starts Sentry with. */
export const sentryOptions = (dsn: string) => ({
  dsn,
  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
  // errors only, no performance tracing
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
