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
    const { order_id } = body;

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

    // Only completed orders can have escrow released
    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "Order must be completed before releasing escrow" },
        { status: 400 }
      );
    }

    if (order.escrow_released) {
      return NextResponse.json({ message: "Escrow already released" });
    }

    if (!order.payment_intent_id) {
      return NextResponse.json(
        { error: "No payment intent found for this order" },
        { status: 400 }
      );
    }

    // Capture the held payment
    const paymentIntent = await stripe.paymentIntents.capture(order.payment_intent_id);

    // Record the transaction
    await supabaseAdmin.from("transactions").insert([
      {
        order_id: order.id,
        type: "payment",
        amount: order.amount,
        currency: order.currency,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      },
      {
        order_id: order.id,
        type: "platform_fee",
        amount: order.platform_fee,
        currency: order.currency,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      },
      {
        order_id: order.id,
        type: "seller_payout",
        amount: order.seller_amount,
        currency: order.currency,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      },
    ]);

    // Mark escrow as released
    await supabaseAdmin
      .from("orders")
      .update({
        escrow_released: true,
        escrow_released_at: new Date().toISOString(),
        payment_status: "paid",
      })
      .eq("id", order_id);

    // Log event
    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event_type: "payment",
      metadata: { action: "escrow_released", payment_intent_id: paymentIntent.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Stripe Escrow Release]", error);
    const message = error instanceof Error ? error.message : "Failed to release escrow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
