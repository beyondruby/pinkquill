import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Updates the Supabase session on each request.
 * This is critical for keeping the auth session fresh during navigation.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: DO NOT use getSession() here as it doesn't validate the JWT.
  // Use getUser() which properly validates the auth token.
  // This refreshes the session if needed and keeps the user authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optionally redirect unauthenticated users from protected routes
  // Uncomment if you want to protect certain routes:
  // const protectedRoutes = ['/create', '/messages', '/settings'];
  // if (!user && protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  return supabaseResponse;
}
