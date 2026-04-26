import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/utils/redirect";

/**
 * Build a redirect URL whose **hash fragment** carries the session
 * tokens. The hash is never sent to a server, so this is a safe way to
 * hand the session off to the client-side Supabase SDK (which has
 * `detectSessionInUrl: true` and consumes hash tokens on first load).
 *
 * Without this, the recovery callback would set the session in cookies
 * only — the localStorage-based client would never see it, and the
 * subsequent `supabase.auth.updateUser({ password })` call would throw
 * "Auth session missing!".
 */
function buildSessionRedirect(
  basePath: string,
  origin: string,
  session: { access_token: string; refresh_token: string; expires_in?: number }
): URL {
  const url = new URL(basePath, origin);
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: "bearer",
    type: "recovery",
  });
  if (session.expires_in !== undefined) {
    params.set("expires_in", String(session.expires_in));
  }
  url.hash = params.toString();
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const type = requestUrl.searchParams.get("type");

  if (code) {
    const cookieStore = await cookies();
    let cookieSetFailed = false;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (err) {
              // Only ignore the specific "cookies from Server Component" error.
              // Log anything else so session failures are visible.
              const msg = err instanceof Error ? err.message : "";
              if (!msg.includes("Server Component")) {
                console.error("[Auth Callback] Failed to set cookies:", err);
                cookieSetFailed = true;
              }
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] Code exchange failed:", error.message);
      return NextResponse.redirect(
        new URL(`/settings/account?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }

    if (cookieSetFailed) {
      console.error("[Auth Callback] Session established but cookies could not be saved");
    }

    // Recovery flow: pass the session tokens via the URL hash so the
    // client SDK can populate its localStorage session before the user
    // tries to set a new password on /settings/account?reset=true.
    if (type === "recovery") {
      const session = data.session;
      const targetPath = "/settings/account?reset=true";
      if (session?.access_token && session?.refresh_token) {
        return NextResponse.redirect(
          buildSessionRedirect(targetPath, requestUrl.origin, session)
        );
      }
      return NextResponse.redirect(new URL(targetPath, requestUrl.origin));
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // No auth code present in the URL
  return NextResponse.redirect(
    new URL("/settings/account?error=email_confirmation_failed", requestUrl.origin)
  );
}
