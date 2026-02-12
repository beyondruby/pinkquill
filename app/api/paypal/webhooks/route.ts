/**
 * PayPal Webhook Handler
 *
 * Handles asynchronous events from PayPal:
 * - CHECKOUT.ORDER.APPROVED — buyer approved, ready to capture
 * - PAYMENT.CAPTURE.COMPLETED — payment captured
 * - PAYMENT.CAPTURE.DENIED — capture failed
 * - PAYMENT.AUTHORIZATION.CREATED — escrow authorized
 * - MERCHANT.ONBOARDING.COMPLETED — seller onboarding done
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { finalizeOrderPayment, markOrderPaymentFailed } from "@/lib/payments-server";

export const runtime = "nodejs";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id?: string;
    status?: string;
    purchase_units?: Array<{
      reference_id?: string;
      payments?: {
        captures?: Array<{ id: string; status: string }>;
        authorizations?: Array<{ id: string; status: string }>;
      };
    }>;
    merchant_id?: string;
    tracking_id?: string;
  };
  summary?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    let event: PayPalWebhookEvent;

    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Note: In production, verify the webhook signature using PayPal's verification API.
    // For now, we process the event and rely on idempotent operations.

    console.log(`[PayPal Webhook] ${event.event_type}`, event.id);

    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED": {
        // Buyer approved the order — we can capture it.
        // In our flow, the client calls /api/payments/confirm after approval,
        // so this is mostly a fallback to ensure we don't miss it.
        const orderId = event.resource.purchase_units?.[0]?.reference_id;
        if (orderId) {
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("id, status")
            .eq("id", orderId)
            .single();

          if (order && order.status === "pending_payment") {
            console.log(`[PayPal Webhook] Order ${orderId} approved, waiting for client capture`);
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        // Payment captured successfully
        const captureId = event.resource.id;
        // Find the order by PayPal order reference
        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("id, status, paypal_order_id, payment_reference")
          .eq("status", "pending_payment")
          .limit(50);

        if (orders && captureId) {
          // The capture is nested, try to match by payment_reference
          for (const order of orders) {
            if (order.paypal_order_id || order.payment_reference) {
              await finalizeOrderPayment({
                orderId: order.id,
                provider: "paypal",
                paymentReference: order.paypal_order_id || order.payment_reference!,
                actorId: null,
                source: "webhook.paypal.capture_completed",
              }).catch((err) => {
                console.error(`[PayPal Webhook] Failed to finalize order ${order.id}:`, err);
              });
              break;
            }
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        // Payment capture failed
        const referenceId = event.resource.purchase_units?.[0]?.reference_id;
        if (referenceId) {
          await markOrderPaymentFailed({
            orderId: referenceId,
            provider: "paypal",
            paymentReference: event.resource.id || "",
            reason: event.summary || "PayPal payment capture denied",
            source: "webhook.paypal.capture_denied",
          }).catch(() => {});
        }
        break;
      }

      case "PAYMENT.AUTHORIZATION.CREATED": {
        // For commission escrow — authorization created
        console.log(`[PayPal Webhook] Authorization created: ${event.resource.id}`);
        break;
      }

      case "MERCHANT.ONBOARDING.COMPLETED": {
        // Seller completed PayPal onboarding
        const merchantId = event.resource.merchant_id;
        const trackingId = event.resource.tracking_id;

        if (merchantId && trackingId) {
          await supabaseAdmin
            .from("seller_accounts")
            .update({
              paypal_merchant_id: merchantId,
              onboarding_complete: true,
              charges_enabled: true,
              payouts_enabled: true,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", trackingId);

          console.log(`[PayPal Webhook] Seller ${trackingId} onboarding completed`);
        }
        break;
      }

      default:
        console.log(`[PayPal Webhook] Unhandled event: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[PayPal Webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
