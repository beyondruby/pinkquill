import { NextResponse } from "next/server";
import { stripe, STRIPE_FEES } from "@/lib/stripe";
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

    // Fetch order with seller info
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, product:products(seller_id, title)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify the authenticated user is the buyer
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Verify order is in pending_payment status
    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Order is already ${order.status}` },
        { status: 400 }
      );
    }

    // Get seller's Stripe account
    const sellerId = (order.product as { seller_id: string }).seller_id;
    const { data: sellerAccount } = await supabaseAdmin
      .from("seller_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("user_id", sellerId)
      .single();

    if (!sellerAccount?.stripe_account_id || !sellerAccount.charges_enabled) {
      return NextResponse.json(
        { error: "Seller has not completed payment setup. Please contact the seller." },
        { status: 400 }
      );
    }

    // Calculate fees (amount is stored in dollars, Stripe uses cents)
    const amountInCents = Math.round(order.amount * 100);
    const feeRate = order.listing_type === "service" ? STRIPE_FEES.service : STRIPE_FEES.product;
    const applicationFeeInCents = Math.round(amountInCents * feeRate);

    // For commissions (services), use manual capture for escrow
    // For products, capture immediately
    const isEscrow = order.listing_type === "service";
    const productTitle = (order.product as { title: string }).title;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: order.currency || "usd",
      application_fee_amount: applicationFeeInCents,
      capture_method: isEscrow ? "manual" : "automatic",
      transfer_data: {
        destination: sellerAccount.stripe_account_id,
      },
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        buyer_id: order.buyer_id,
        seller_id: sellerId,
        listing_type: order.listing_type,
      },
      description: `Pinkquill order ${order.order_number} — ${productTitle}`,
    });

    // Store payment_intent_id on the order
    await supabaseAdmin
      .from("orders")
      .update({
        payment_intent_id: paymentIntent.id,
        payment_status: "pending",
      })
      .eq("id", order_id);

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (error) {
    console.error("[Stripe Checkout]", error);
    const message = error instanceof Error ? error.message : "Failed to create payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
