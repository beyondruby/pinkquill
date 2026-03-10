import Stripe from "stripe";
import { NextResponse } from "next/server";
import { finalizeOrderPayment, markOrderPaymentFailed } from "@/lib/payments-server";
import { extractStripeDeclineDetails } from "@/lib/stripe-decline-details";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OrderLookup {
  id: string;
  buyer_id: string;
  status: string;
  payment_status: string;
  amount: number;
  currency: string;
}

async function findOrderByPaymentIntent(paymentIntentId: string): Promise<OrderLookup | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, status, payment_status, amount, currency")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle<OrderLookup>();

  return data || null;
}

async function findOrderById(orderId: string): Promise<OrderLookup | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, status, payment_status, amount, currency")
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
        const eventPaymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntent = await stripe.paymentIntents.retrieve(eventPaymentIntent.id, {
          expand: ["latest_charge", "last_payment_error.payment_method"],
        }).catch(() => eventPaymentIntent);
        const order = await resolveOrder(paymentIntent);
        if (!order) {
          console.warn("[Stripe Webhook] No order found for failed payment intent", paymentIntent.id);
          break;
        }

        const declineDetails = extractStripeDeclineDetails(paymentIntent);
        console.warn("[Stripe Webhook] Stripe payment failed", {
          order_id: order.id,
          payment_intent_id: paymentIntent.id,
          failure_category: declineDetails.failure_category,
          decline_code: declineDetails.decline_code,
          merchant_context: declineDetails.merchant_context,
          integration_hints: declineDetails.integration_hints,
        });
        await markOrderPaymentFailed({
          orderId: order.id,
          provider: "stripe",
          paymentReference: paymentIntent.id,
          reason: paymentIntent.last_payment_error?.message || `Stripe event: ${event.type}`,
          errorDetails: declineDetails,
          source: `stripe.webhook.${event.type}`,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!paymentIntentId) break;

        const order = await findOrderByPaymentIntent(paymentIntentId);
        if (!order) break;

        const now = new Date().toISOString();
        const refundedAmount = Number(charge.amount_refunded || 0) / 100;
        const chargeAmount = Number(charge.amount || 0) / 100;
        const isFullyRefunded = Boolean(
          charge.refunded || (charge.amount_refunded || 0) >= (charge.amount || 0)
        );
        const refundAmountForLedger = refundedAmount > 0
          ? refundedAmount
          : (isFullyRefunded ? Number(order.amount) : 0);

        if (isFullyRefunded && order.payment_status === "refunded") break;

        const { error: orderUpdateError } = await supabaseAdmin
          .from("orders")
          .update({
            ...(isFullyRefunded ? { status: "refunded" } : {}),
            payment_status: isFullyRefunded ? "refunded" : "partially_refunded",
            updated_at: now,
          })
          .eq("id", order.id);
        if (orderUpdateError) {
          throw new Error(orderUpdateError.message);
        }

        if (isFullyRefunded) {
          const { error: txStatusError } = await supabaseAdmin
            .from("transactions")
            .update({ status: "refunded" })
            .eq("order_id", order.id)
            .in("status", ["pending", "completed"]);
          if (txStatusError) {
            throw new Error(txStatusError.message);
          }
        }

        const { data: existingRefund, error: existingRefundError } = await supabaseAdmin
          .from("transactions")
          .select("id, amount")
          .eq("order_id", order.id)
          .eq("type", "refund")
          .maybeSingle<{ id: string; amount: number }>();
        if (existingRefundError) {
          throw new Error(existingRefundError.message);
        }

        if (existingRefund && refundAmountForLedger > 0) {
          const { error: updateRefundTxError } = await supabaseAdmin
            .from("transactions")
            .update({
              amount: Math.max(Number(existingRefund.amount || 0), refundAmountForLedger),
              status: "completed",
              metadata: {
                provider: "stripe",
                stripe_charge_id: charge.id,
                source: "stripe.webhook.charge_refunded",
                refund_type: isFullyRefunded ? "full" : "partial",
              },
            })
            .eq("id", existingRefund.id);
          if (updateRefundTxError) {
            throw new Error(updateRefundTxError.message);
          }
        } else if (!existingRefund && refundAmountForLedger > 0) {
          const { error: insertRefundTxError } = await supabaseAdmin.from("transactions").insert({
            order_id: order.id,
            type: "refund",
            amount: refundAmountForLedger,
            currency: order.currency,
            status: "completed",
            metadata: {
              provider: "stripe",
              stripe_charge_id: charge.id,
              source: "stripe.webhook.charge_refunded",
              refund_type: isFullyRefunded ? "full" : "partial",
            },
          });
          if (insertRefundTxError) {
            throw new Error(insertRefundTxError.message);
          }
        }

        const { error: orderEventError } = await supabaseAdmin.from("order_events").insert({
          order_id: order.id,
          actor_id: order.buyer_id,
          event_type: "payment",
          metadata: {
            action: isFullyRefunded ? "refund" : "partial_refund",
            provider: "stripe",
            source: "stripe.webhook.charge_refunded",
            stripe_charge_id: charge.id,
            refunded_amount: refundAmountForLedger,
            charge_amount: chargeAmount,
          },
        });
        if (orderEventError) {
          throw new Error(orderEventError.message);
        }

        const { error: orderMessageError } = await supabaseAdmin.from("order_messages").insert({
          order_id: order.id,
          sender_id: order.buyer_id,
          content: isFullyRefunded
            ? "Your payment has been refunded."
            : "A partial refund has been issued for your payment.",
          message_type: "system",
        });
        if (orderMessageError) {
          throw new Error(orderMessageError.message);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (!account.id) break;

        const { data: sellerAccount } = await supabaseAdmin
          .from("seller_accounts")
          .select("id, user_id")
          .eq("stripe_account_id", account.id)
          .maybeSingle();

        if (sellerAccount) {
          await supabaseAdmin
            .from("seller_accounts")
            .update({
              onboarding_complete: account.details_submitted ?? false,
              charges_enabled: account.charges_enabled ?? false,
              payouts_enabled: account.payouts_enabled ?? false,
              country: account.country || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sellerAccount.id);
        }
        break;
      }

      case "payment_intent.amount_capturable_updated": {
        // Escrow authorization confirmed — update order payment_status to "authorized"
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const order = await resolveOrder(paymentIntent);
        if (!order) break;

        if (order.payment_status !== "authorized") {
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "authorized", updated_at: new Date().toISOString() })
            .eq("id", order.id);
        }
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
