/**
 * Lightweight client → server diagnostic for the auth-init / lock stalls
 * described in docs/audit/01-findings.md (H1, H2).
 *
 * Why this exists: Sentry is disabled and the middleware's own timeout log
 * fires after every request, so today nothing tells us whether a "stuck on
 * loading" report was a cross-tab auth-lock deadlock, a slow refresh, or a
 * network problem. This posts a tiny JSON record (including the Web Locks
 * state) to /api/diagnostics/auth, which logs it to the server console where
 * `vercel logs` can grep for "[auth-diagnostic]".
 *
 * It deliberately does NOT touch the Supabase client — the whole point is to
 * report when that client is wedged.
 */

export type AuthDiagnosticKind =
  | "auth_init_slow"
  | "auth_init_timeout"
  | "auth_init_error"
  | "auth_lock_timeout";

const MAX_REPORTS_PER_PAGE_LOAD = 5;
let reportsSent = 0;

type LockInfo = { name?: string; clientId?: string; mode?: string };

async function snapshotLocks(): Promise<{ held: LockInfo[]; pending: LockInfo[] } | null> {
  try {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.query) return null;
    const state = await locks.query();
    const pick = (l: LockInfo) => ({ name: l.name, clientId: l.clientId, mode: l.mode });
    return {
      held: (state.held ?? []).map(pick),
      pending: (state.pending ?? []).map(pick),
    };
  } catch {
    return null;
  }
}

export async function reportAuthDiagnostic(
  kind: AuthDiagnosticKind,
  details: Record<string, unknown> = {}
): Promise<void> {
  if (typeof window === "undefined") return;
  if (reportsSent >= MAX_REPORTS_PER_PAGE_LOAD) return;
  reportsSent += 1;

  const payload = {
    kind,
    at: new Date().toISOString(),
    path: window.location.pathname,
    visibility: document.visibilityState,
    online: navigator.onLine,
    sinceNavigationMs: Math.round(performance.now()),
    locks: await snapshotLocks(),
    ...details,
  };

  console.warn("[auth-diagnostic]", kind, payload);

  const body = JSON.stringify(payload);
  try {
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(
        "/api/diagnostics/auth",
        new Blob([body], { type: "application/json" })
      );
      return;
    }
    await fetch("/api/diagnostics/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    // Diagnostics must never affect the page.
  }
}
