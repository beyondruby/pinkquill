// Sentry edge configuration - DISABLED
// @sentry/nextjs does not yet support Next.js 16
// Re-enable when Sentry releases Next.js 16 support
// See: https://github.com/getsentry/sentry-javascript/issues

/*
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",
});
*/

export {};
