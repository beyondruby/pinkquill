import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Creates a Supabase client bound to the current request's cookies.
 * Use in API routes to get the authenticated user.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // Called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}

function getBearerToken(request?: Request): string | null {
  if (!request) return null;

  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  const normalizedToken = token?.trim();
  return normalizedToken || null;
}

/**
 * Gets the authenticated user from the current request.
 * Prefers an Authorization bearer token (current client session) and
 * falls back to server-side auth cookies.
 */
export async function getAuthUser(request?: Request) {
  const bearerToken = getBearerToken(request);
  let bearerError: string | null = null;

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
    if (!error && data.user) {
      return data.user;
    }
    bearerError = error?.message ?? "no user from bearer";
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: cookieError } = await supabase.auth.getUser();
  if (user) return user;

  // Diagnostic: log only when we're about to deny the caller. Lets us
  // distinguish "no auth at all" from "stale token" without exposing
  // anything to the client.
  const cookieHeader = request?.headers.get("cookie") || "";
  const sbCookies = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n.startsWith("sb-"));
  console.warn("[getAuthUser] returning null", {
    hasBearer: Boolean(bearerToken),
    bearerError,
    sbCookies,
    cookieError: cookieError?.message ?? null,
  });

  return null;
}
