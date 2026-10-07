// Error reporting to Sentry, on the server, when SENTRY_DSN is set (lib/sentryScrub.ts
// keeps passwords and personal details out of the reports).
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentryScrub";

export function register() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (dsn) Sentry.init(sentryOptions(dsn));
}

export const onRequestError = Sentry.captureRequestError;
