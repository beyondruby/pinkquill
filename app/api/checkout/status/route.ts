import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api-security";

export const runtime = "nodejs";

/**
 * Order state for the checkout return page. Reads the database only — the
 * webhook is the source of truth for payment, so the page must never declare
 * success from Stripe's session status alone.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({ request, scope: "checkout.status", limit: 60, windowSeconds: 60, userId: user.id });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const orderIdParam = searchParams.get("order_id");

    if (!sessionId && !orderIdParam) {
      return NextResponse.json({ error: "session_id or order_id is required" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_status, last_payment_error");
    query = sessionId ? query.eq("checkout_session_id", sessionId) : query.eq("id", orderIdParam as string);
    const { data: order } = await query.maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const lastError = (order.last_payment_error as { message?: string } | null) ?? null;

    return NextResponse.json({
      order_id: order.id,
      order_status: order.status,
      order_payment_status: order.payment_status,
      last_payment_error: lastError?.message ?? null,
    });
  } catch (err) {
    console.error("[GET /api/checkout/status] Error:", err);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
