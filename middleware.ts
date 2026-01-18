import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Simply pass through - the main purpose of this middleware
  // is to use the matcher config below to exclude static files
  // from any processing. Auth is handled client-side.
  return NextResponse.next();
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
