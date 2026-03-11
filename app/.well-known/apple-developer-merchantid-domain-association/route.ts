import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves the Apple Pay domain verification file.
 * Stripe requires this file at /.well-known/apple-developer-merchantid-domain-association
 * to enable Apple Pay on your domain.
 *
 * The file content is fetched from Stripe's hosted URL.
 */
export async function GET() {
  try {
    const res = await fetch(
      "https://stripe.com/files/apple-pay/apple-developer-merchantid-domain-association",
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!res.ok) {
      return new NextResponse("File not available", { status: 502 });
    }

    const content = await res.text();

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
