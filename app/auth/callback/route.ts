import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Validate redirect URL to prevent open redirect attacks
function getSafeRedirectUrl(next: string | null): string {
  if (!next) return "/";

  // Only allow relative paths starting with /
  // Block protocol-relative URLs (//evil.com), absolute URLs, and javascript:
  const trimmed = next.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.toLowerCase().includes("://") ||
    trimmed.toLowerCase().startsWith("javascript:")
  ) {
    return "/";
  }

  return trimmed;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeRedirectUrl(requestUrl.searchParams.get("next"));
  const type = requestUrl.searchParams.get("type");

  if (code) {
    const cookieStore = await cookies();

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
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Handle different callback types
      if (type === "recovery") {
        // Password recovery - redirect to password reset page
        return NextResponse.redirect(
          new URL("/settings/account?reset=true", requestUrl.origin)
        );
      }

      // Email confirmation or email change - redirect to next URL
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If there's an error or no code, redirect to settings with error
  return NextResponse.redirect(
    new URL("/settings/account?error=email_confirmation_failed", requestUrl.origin)
  );
}
