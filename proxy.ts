import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/create",
  "/messages",
  "/saved",
  "/settings",
  "/insights",
  "/takes/create",
  "/community/create",
  "/sell",
];

// Routes only accessible when NOT authenticated
const AUTH_ROUTES = ["/login"];

function isProtectedRoute(pathname: string): boolean {
  // The home feed "/" is protected
  if (pathname === "/") return true;
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // Static files (favicon, images, etc.)
  ) {
    return NextResponse.next();
  }

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

  // Refresh session - this is required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users from protected routes to login
  if (!user && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users from auth routes to home
  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - All static assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|mp3|mp4|webm|ogg|wav|pdf)$).*)",
  ],
};
