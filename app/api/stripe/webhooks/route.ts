import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import type Stripe from "stripe";

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.order_id;
  if (!orderId) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, listing_type, status, amount, platform_fee, seller_amount, currency")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "pending_payment") return;

  // For automatic capture (products), payment is complete
  // For manual capture (escrow/services), payment is authorized
  const isEscrow = paymentIntent.capture_method === "manual";
  const paymentStatus = isEscrow ? "authorized" : "paid";
  const orderStatus = "paid";

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: paymentStatus,
      status: orderStatus,
    })
    .eq("id", orderId);

  // Record transaction for non-escrow (immediate capture)
  if (!isEscrow) {
    await supabaseAdmin.from("transactions").insert([
      {
        order_id: orderId,
        type: "payment",
        amount: order.amount,
        currency: order.currency,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      },
      {
        order_id: orderId,
        type: "platform_fee",
        amount: order.platform_fee,
        currency: order.currency,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      },
      {
        order_id: orderId,
        type: "seller_payout",
        amount: order.seller_amount,
        currency: order.currency,
        stripe_payment_intent_id: paymentIntent.id,
        status: "completed",
      },
    ]);
  }

  // Log event
  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    event_type: "payment",
    metadata: {
      payment_intent_id: paymentIntent.id,
      payment_status: paymentStatus,
      capture_method: paymentIntent.capture_method,
    },
  });

  // System message
  await supabaseAdmin.from("order_messages").insert({
    order_id: orderId,
    sender_id: order.id, // placeholder — system messages
    content: "Payment confirmed — order is now active!",
    message_type: "system",
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.order_id;
  if (!orderId) return;

  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "failed" })
    .eq("id", orderId);

  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    event_type: "payment",
    metadata: {
      payment_intent_id: paymentIntent.id,
      payment_status: "failed",
      failure_message: paymentIntent.last_payment_error?.message,
    },
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, amount, currency")
    .eq("payment_intent_id", paymentIntentId)
    .single();

  if (!order) return;

  const isFullRefund = charge.amount_refunded === charge.amount;

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: isFullRefund ? "refunded" : "partially_refunded",
      status: isFullRefund ? "refunded" : undefined,
    })
    .eq("id", order.id);

  await supabaseAdmin.from("transactions").insert({
    order_id: order.id,
    type: "refund",
    amount: charge.amount_refunded / 100,
    currency: order.currency,
    stripe_payment_intent_id: paymentIntentId,
    stripe_charge_id: charge.id,
    status: "completed",
  });

  await supabaseAdmin.from("order_events").insert({
    order_id: order.id,
    event_type: "payment",
    metadata: {
      action: "refund",
      amount_refunded: charge.amount_refunded / 100,
      full_refund: isFullRefund,
    },
  });
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Sync seller account status from Stripe
  await supabaseAdmin
    .from("seller_accounts")
    .update({
      onboarding_complete: account.details_submitted ?? false,
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      country: account.country || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // Determine which webhook secret to use
    // Connect events have an "account" field in the event
    let event: Stripe.Event;

    try {
      // Try platform webhook first
      if (WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
      } else if (CONNECT_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(body, signature, CONNECT_WEBHOOK_SECRET);
      } else {
        console.error("[Stripe Webhook] No webhook secret configured");
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
      }
    } catch (err) {
      // If first secret fails, try connect secret
      if (CONNECT_WEBHOOK_SECRET && WEBHOOK_SECRET) {
        try {
          event = stripe.webhooks.constructEvent(body, signature, CONNECT_WEBHOOK_SECRET);
        } catch {
          console.error("[Stripe Webhook] Invalid signature");
          return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }
      } else {
        console.error("[Stripe Webhook] Invalid signature", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        // Unhandled event type — log but don't error
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
