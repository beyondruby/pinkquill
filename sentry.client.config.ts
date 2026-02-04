// Sentry client configuration - DISABLED
// @sentry/nextjs does not yet support Next.js 16
// Re-enable when Sentry releases Next.js 16 support
// See: https://github.com/getsentry/sentry-javascript/issues

/*
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Filter out common non-errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors users can't fix
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // User-initiated navigation
    "AbortError",
    "The operation was aborted",
    // React hydration (usually harmless)
    "Hydration failed",
    "There was an error while hydrating",
    // Generic JS errors from ads/third-party
    "Script error",
    "ResizeObserver loop",
  ],

  beforeSend(event, hint) {
    // Don't send events for blocked users viewing profiles (expected behavior)
    if (hint.originalException instanceof Error) {
      if (hint.originalException.message?.includes("User not found")) {
        return null;
      }
    }
    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});
*/

export {};
