import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Filter out expected errors
  ignoreErrors: [
    // Supabase RLS errors (expected for unauthorized access)
    "new row violates row-level security policy",
    // User not found (expected for blocked users)
    "PGRST116",
  ],

  beforeSend(event, hint) {
    // Don't send events for expected auth failures
    if (hint.originalException instanceof Error) {
      const message = hint.originalException.message;
      if (
        message?.includes("JWT expired") ||
        message?.includes("Invalid Refresh Token") ||
        message?.includes("Auth session missing")
      ) {
        return null;
      }
    }
    return event;
  },
});
