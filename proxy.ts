import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth/protected-paths";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 proxy (formerly `middleware.ts`).
 *
 * Two responsibilities, in order:
 *   1. Refresh the Supabase auth token on every request via updateSession().
 *      This keeps the cookie session in sync between server and browser —
 *      the missing piece that caused the "Auth session missing!" / "Not
 *      authenticated" cycle every time we touched auth.
 *   2. Gate protected paths: if the path is in PROTECTED_PREFIXES and the
 *      caller has no valid session after the refresh, redirect to /login
 *      preserving the original destination as ?redirect=.
 *
 * The homepage intentionally stays public so guests can browse the feed and
 * only hit auth when they try to act.
 *
 * IMPORTANT: updateSession MUST run before any other logic that reads cookies
 * — its `getUser()` call refreshes the token AND writes new cookies onto the
 * response we return. Do not read cookies before it.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!isProtectedPath(request.nextUrl.pathname) || user) {
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("redirect", redirectTarget);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - All static assets (images, fonts, etc.)
     * - Machine-to-machine routes that carry no user cookie and must not
     *   pay a GoTrue round trip: Stripe webhook, cron endpoints, the
     *   diagnostics sink, and the OAuth/PKCE callback (which sets its own
     *   cookies).
     * - Static prose routes (/about, /help, /privacy, /terms, guidelines):
     *   no server data and no session-dependent markup; the browser client
     *   keeps the cookie fresh on its own.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/stripe/webhooks|api/orders/auto-complete|api/orders/auto-decline|api/diagnostics/|auth/callback|about|help|privacy|terms|community-guidelines|marketplace-guidelines|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|mp3|mp4|webm|ogg|wav|pdf)$).*)",
  ],
};
