import Stripe from "stripe";
import { NextResponse } from "next/server";
import { finalizeOrderPayment, markOrderPaymentFailed } from "@/lib/payments-server";
import { getPaymentProvider } from "@/lib/payments";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OrderLookup {
  id: string;
  buyer_id: string;
  payment_status: string;
  amount: number;
  currency: string;
}

async function findOrderByPaymentIntent(paymentIntentId: string): Promise<OrderLookup | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, payment_status, amount, currency")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle<OrderLookup>();

  return data || null;
}

async function findOrderById(orderId: string): Promise<OrderLookup | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, payment_status, amount, currency")
    .eq("id", orderId)
    .maybeSingle<OrderLookup>();

  return data || null;
}

async function resolveOrder(paymentIntent: Stripe.PaymentIntent): Promise<OrderLookup | null> {
  const metadataOrderId = paymentIntent.metadata?.order_id;
  if (metadataOrderId) {
    const fromMetadata = await findOrderById(metadataOrderId);
    if (fromMetadata) return fromMetadata;
  }
  return findOrderByPaymentIntent(paymentIntent.id);
}

export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (provider !== "stripe") {
    return NextResponse.json({
      received: true,
      skipped: true,
      reason: "Webhook processing is disabled while placeholder payments are active.",
    });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeServer();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const order = await resolveOrder(paymentIntent);
        if (!order) {
          console.warn("[Stripe Webhook] No order found for payment intent", paymentIntent.id);
          break;
        }

        await finalizeOrderPayment({
          orderId: order.id,
          provider: "stripe",
          paymentReference: paymentIntent.id,
          actorId: order.buyer_id,
          source: "stripe.webhook.payment_intent_succeeded",
        });
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const order = await resolveOrder(paymentIntent);
        if (!order) {
          console.warn("[Stripe Webhook] No order found for failed payment intent", paymentIntent.id);
          break;
        }

        await markOrderPaymentFailed({
          orderId: order.id,
          provider: "stripe",
          paymentReference: paymentIntent.id,
          reason: paymentIntent.last_payment_error?.message || `Stripe event: ${event.type}`,
          source: `stripe.webhook.${event.type}`,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!paymentIntentId) break;

        const order = await findOrderByPaymentIntent(paymentIntentId);
        if (!order || order.payment_status === "refunded") break;

        await supabaseAdmin
          .from("orders")
          .update({
            status: "refunded",
            payment_status: "refunded",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        await supabaseAdmin
          .from("transactions")
          .update({ status: "refunded" })
          .eq("order_id", order.id)
          .in("status", ["pending", "completed"]);

        const { data: existingRefund } = await supabaseAdmin
          .from("transactions")
          .select("id")
          .eq("order_id", order.id)
          .eq("type", "refund")
          .maybeSingle();

        if (!existingRefund) {
          await supabaseAdmin.from("transactions").insert({
            order_id: order.id,
            type: "refund",
            amount: order.amount,
            currency: order.currency,
            status: "completed",
            metadata: {
              provider: "stripe",
              stripe_charge_id: charge.id,
              source: "stripe.webhook.charge_refunded",
            },
          });
        }

        await supabaseAdmin.from("order_events").insert({
          order_id: order.id,
          actor_id: order.buyer_id,
          event_type: "payment",
          metadata: {
            action: "refund",
            provider: "stripe",
            source: "stripe.webhook.charge_refunded",
            stripe_charge_id: charge.id,
          },
        });

        await supabaseAdmin.from("order_messages").insert({
          order_id: order.id,
          content: "Your payment has been refunded.",
          message_type: "system",
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[Stripe Webhook] processing error", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
