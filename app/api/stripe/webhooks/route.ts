import Stripe from "stripe";
import { NextResponse } from "next/server";
import { finalizeOrderPayment, markOrderPaymentFailed, markOrderExpired } from "@/lib/payments-server";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getActiveProvider } from "@/lib/payment-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OrderLookup {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  payment_status: string;
  amount: number;
  currency: string;
  listing_type: string;
  transfer_id: string | null;
}

async function findOrderByCheckoutSession(sessionId: string): Promise<OrderLookup | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, seller_id, status, payment_status, amount, currency, listing_type, transfer_id")
    .eq("checkout_session_id", sessionId)
    .maybeSingle<OrderLookup>();

  return data || null;
}

async function findOrderById(orderId: string): Promise<OrderLookup | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, seller_id, status, payment_status, amount, currency, listing_type, transfer_id")
    .eq("id", orderId)
    .maybeSingle<OrderLookup>();

  return data || null;
}

/**
 * Process pending transfers for a seller who just completed onboarding.
 */
async function processPendingTransfers(stripeAccountId: string) {
  const { data: sellerAccount } = await supabaseAdmin
    .from("seller_accounts")
    .select("user_id")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();

  if (!sellerAccount) return 0;

  const { data: pendingOrders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("seller_id", sellerAccount.user_id)
    .eq("transfer_status", "pending_onboarding")
    .in("status", ["completed", "delivered"]);

  if (!pendingOrders?.length) return 0;

  let transferred = 0;
  const provider = getActiveProvider();
  for (const order of pendingOrders) {
    try {
      await provider.transferToSeller(order.id);
      transferred++;
    } catch (err) {
      console.error(`[Stripe Webhook] Failed to process pending transfer for order ${order.id}:`, err);
    }
  }
  return transferred;
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

  // Idempotency check
  const { data: existingEvent } = await supabaseAdmin
    .from("order_events")
    .select("id")
    .or(`metadata->>stripe_event_id.eq.${event.id},metadata->>source.like.%${event.id}%`)
    .limit(1)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json({ received: true, already_processed: true });
  }

  try {
    switch (event.type) {
      // ─── Payment completed via Checkout Session ───────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          console.warn("[Stripe Webhook] checkout.session.completed missing order_id metadata", session.id);
          break;
        }

        const order = await findOrderById(orderId);
        if (!order) {
          console.warn("[Stripe Webhook] No order found for checkout session", session.id);
          break;
        }

        await finalizeOrderPayment({
          orderId: order.id,
          provider: "stripe",
          paymentReference: session.id,
          actorId: order.buyer_id,
          source: `stripe.webhook.checkout_session_completed:${event.id}`,
        });

        // Auto-transfer for digital products (immediate delivery)
        const { data: orderWithProduct } = await supabaseAdmin
          .from("orders")
          .select("product:products (delivery_type)")
          .eq("id", order.id)
          .single();

        const productData = Array.isArray(orderWithProduct?.product)
          ? orderWithProduct.product[0]
          : orderWithProduct?.product;

        if (productData?.delivery_type === "digital" || order.listing_type === "product") {
          try {
            await getActiveProvider().transferToSeller(order.id);
          } catch {
            // Non-blocking — transfer can be retried via auto-complete
          }
        }
        break;
      }

      // ─── Checkout expired (buyer abandoned) ───────────────────
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) break;

        const order = await findOrderById(orderId);
        if (!order) break;

        await markOrderExpired({
          orderId: order.id,
          provider: "stripe",
          paymentReference: session.id,
          source: `stripe.webhook.checkout_session_expired:${event.id}`,
        });
        break;
      }

      // ─── Refund processed ─────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!paymentIntentId) break;

        // Find order by checkout session that contains this payment intent
        // First try via the payment intent's metadata
        let order: OrderLookup | null = null;
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.metadata?.order_id) {
          order = await findOrderById(pi.metadata.order_id);
        }

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

        // If transfer was already sent, reverse it
        if (order.transfer_id) {
          try {
            await stripe.transfers.createReversal(order.transfer_id, {
              metadata: { order_id: order.id, reason: "refund", stripe_event_id: event.id },
            });

            await supabaseAdmin
              .from("orders")
              .update({ transfer_status: "reversed", updated_at: now })
              .eq("id", order.id);
          } catch (err) {
            console.error("[Stripe Webhook] Transfer reversal failed:", err);
          }
        }

        await supabaseAdmin
          .from("orders")
          .update({
            ...(isFullyRefunded ? { status: "refunded" } : {}),
            payment_status: isFullyRefunded ? "refunded" : "partially_refunded",
            updated_at: now,
          })
          .eq("id", order.id);

        if (isFullyRefunded) {
          await supabaseAdmin
            .from("transactions")
            .update({ status: "refunded" })
            .eq("order_id", order.id)
            .in("status", ["pending", "completed"]);
        }

        const { data: existingRefund } = await supabaseAdmin
          .from("transactions")
          .select("id, amount")
          .eq("order_id", order.id)
          .eq("type", "refund")
          .maybeSingle<{ id: string; amount: number }>();

        if (existingRefund && refundAmountForLedger > 0) {
          await supabaseAdmin
            .from("transactions")
            .update({
              amount: Math.max(Number(existingRefund.amount || 0), refundAmountForLedger),
              status: "completed",
              metadata: {
                provider: "stripe",
                stripe_charge_id: charge.id,
                stripe_event_id: event.id,
                source: `stripe.webhook.charge_refunded:${event.id}`,
                refund_type: isFullyRefunded ? "full" : "partial",
              },
            })
            .eq("id", existingRefund.id);
        } else if (!existingRefund && refundAmountForLedger > 0) {
          await supabaseAdmin.from("transactions").insert({
            order_id: order.id,
            type: "refund",
            amount: refundAmountForLedger,
            currency: order.currency,
            status: "completed",
            metadata: {
              provider: "stripe",
              stripe_charge_id: charge.id,
              stripe_event_id: event.id,
              source: `stripe.webhook.charge_refunded:${event.id}`,
              refund_type: isFullyRefunded ? "full" : "partial",
            },
          });
        }

        await supabaseAdmin.from("order_events").insert({
          order_id: order.id,
          actor_id: order.buyer_id,
          event_type: "payment",
          metadata: {
            action: isFullyRefunded ? "refund" : "partial_refund",
            provider: "stripe",
            source: `stripe.webhook.charge_refunded:${event.id}`,
            stripe_event_id: event.id,
            stripe_charge_id: charge.id,
            refunded_amount: refundAmountForLedger,
            charge_amount: chargeAmount,
          },
        });

        await supabaseAdmin.from("order_messages").insert({
          order_id: order.id,
          sender_id: order.buyer_id,
          content: isFullyRefunded
            ? "Your payment has been refunded."
            : "A partial refund has been issued for your payment.",
          message_type: "system",
        });
        break;
      }

      // ─── Seller account updated ───────────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (!account.id) break;

        const { data: sellerAccount } = await supabaseAdmin
          .from("seller_accounts")
          .select("id, user_id, payouts_enabled")
          .eq("stripe_account_id", account.id)
          .maybeSingle();

        if (sellerAccount) {
          const wasPayoutsEnabled = sellerAccount.payouts_enabled;

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

          // If seller just completed onboarding, process pending transfers
          if (!wasPayoutsEnabled && account.payouts_enabled) {
            const transferred = await processPendingTransfers(account.id);
            if (transferred > 0) {
              console.log(`[Stripe Webhook] Processed ${transferred} pending transfers for account ${account.id}`);
            }
          }
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
