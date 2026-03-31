import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/create",
  "/messages",
  "/saved",
  "/settings",
  "/orders",
  "/queue",
  "/cart",
  "/pending-collaborations",
  "/seller",
  "/insights",
];

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;

  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("auth-token") && cookie.value.length > 0);
}

export function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname) || hasSupabaseAuthCookie(request)) {
    return NextResponse.next();
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
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|mp3|mp4|webm|ogg|wav|pdf)$).*)",
  ],
};
