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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const RECOVERY_AMR_MAX_AGE_SECONDS = 30 * 60;

/**
 * True when the caller's access token was issued through a password-recovery
 * link recently. Used by /api/auth/change-password to allow a reset without
 * the current password ONLY in that flow. The token itself has already been
 * validated by getAuthUser(); this only reads its claims.
 */
export async function hasRecentRecoveryAuth(request?: Request): Promise<boolean> {
  let token = getBearerToken(request);
  if (!token) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  }
  if (!token) return false;

  const claims = decodeJwtPayload(token);
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return false;
  const now = Math.floor(Date.now() / 1000);
  return amr.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as { method?: string; timestamp?: number };
    if (method !== "recovery") return false;
    return typeof timestamp === "number" ? now - timestamp <= RECOVERY_AMR_MAX_AGE_SECONDS : true;
  });
}

/**
 * Gets the authenticated user from the current request.
 * Prefers an Authorization bearer token (current client session) and
 * falls back to server-side auth cookies. Returns null when neither
 * resolves to a valid user — the middleware has already refreshed the
 * cookie session before we get here, so a null result here means the
 * caller really is unauthenticated.
 */
export async function getAuthUser(request?: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
    if (!error && data.user) {
      return data.user;
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
