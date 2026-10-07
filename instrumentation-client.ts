// Error reporting to Sentry, in the browser, when SENTRY_DSN is set (it's put
// into the page as NEXT_PUBLIC_SENTRY_DSN at build time — see next.config.ts).
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) Sentry.init(sentryOptions(dsn));
