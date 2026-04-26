import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/utils/redirect";

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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] Code exchange failed:", error.message);
      return NextResponse.redirect(
        new URL(`/settings/account?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }

    if (cookieSetFailed) {
      console.error("[Auth Callback] Session established but cookies could not be saved");
    }

    // Handle different callback types
    if (type === "recovery") {
      return NextResponse.redirect(
        new URL("/settings/account?reset=true", requestUrl.origin)
      );
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // No auth code present in the URL
  return NextResponse.redirect(
    new URL("/settings/account?error=email_confirmation_failed", requestUrl.origin)
  );
}
