import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
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

  // IMPORTANT: Do NOT run any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your app
  // vulnerable to security issues.

  // Refresh session if expired - required for Server Components
  // This will refresh the session cookie if needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optional: Redirect unauthenticated users from protected routes
  // Uncomment if you want to protect certain routes
  // const protectedPaths = ['/create', '/messages', '/settings'];
  // const isProtectedPath = protectedPaths.some(path =>
  //   request.nextUrl.pathname.startsWith(path)
  // );
  // if (!user && isProtectedPath) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  // IMPORTANT: You *must* return the supabaseResponse object as is.
  // If you're creating a new response object with NextResponse.next(),
  // make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
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
