import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getPaymentProvider } from "@/lib/payments";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // Find the order by checkout session
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_status")
      .eq("checkout_session_id", sessionId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // For Stripe, check the actual session status
    if (getPaymentProvider() === "stripe" && sessionId.startsWith("cs_") && !sessionId.startsWith("cs_placeholder_")) {
      const stripe = getStripeServer();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return NextResponse.json({
        status: session.status, // 'open', 'complete', 'expired'
        payment_status: session.payment_status, // 'paid', 'unpaid', 'no_payment_required'
        order_id: order.id,
        order_status: order.status,
        order_payment_status: order.payment_status,
      });
    }

    // Placeholder mode
    return NextResponse.json({
      status: "complete",
      payment_status: "paid",
      order_id: order.id,
      order_status: order.status,
      order_payment_status: order.payment_status,
    });
  } catch (err) {
    console.error("[GET /api/checkout/status] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to check status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
