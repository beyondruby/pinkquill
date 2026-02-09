import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { order_id, reason } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only the buyer can request a refund (or triggered by dispute resolution)
    if (user.id !== order.buyer_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (!order.payment_intent_id) {
      return NextResponse.json(
        { error: "No payment found for this order" },
        { status: 400 }
      );
    }

    // Determine refund approach based on escrow state
    const paymentIntent = await stripe.paymentIntents.retrieve(order.payment_intent_id);

    if (paymentIntent.status === "requires_capture") {
      // Escrow: cancel the uncaptured payment
      await stripe.paymentIntents.cancel(order.payment_intent_id);
    } else if (paymentIntent.status === "succeeded") {
      // Already captured: issue a refund
      await stripe.refunds.create({
        payment_intent: order.payment_intent_id,
        reason: "requested_by_customer",
      });
    } else {
      return NextResponse.json(
        { error: `Cannot refund payment in status: ${paymentIntent.status}` },
        { status: 400 }
      );
    }

    // Update order via RPC (request_refund handles status transition + notifications)
    const { error: rpcError } = await supabaseAdmin.rpc("request_refund", {
      p_order_id: order_id,
      p_reason: reason || "Refund requested by buyer",
    });

    // If RPC fails (e.g. already in refund_requested state), still update directly
    if (rpcError) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "refunded",
          payment_status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);
    }

    // Record refund transaction
    await supabaseAdmin.from("transactions").insert({
      order_id: order.id,
      type: "refund",
      amount: order.amount,
      currency: order.currency,
      stripe_payment_intent_id: order.payment_intent_id,
      status: "completed",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Stripe Refund]", error);
    const message = error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
