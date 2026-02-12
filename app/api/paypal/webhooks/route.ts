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
import { paypalFetch } from "@/lib/paypal";

export const runtime = "nodejs";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  create_time?: string;
  resource: {
    id?: string;
    status?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
    purchase_units?: Array<{
      reference_id?: string;
    }>;
    merchant_id?: string;
    tracking_id?: string;
  };
  summary?: string;
}

interface VerifyWebhookResponse {
  verification_status?: string;
}

interface OrderWebhookLookup {
  id: string;
  status: string;
  paypal_order_id: string | null;
  payment_reference: string | null;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

async function verifyWebhookSignature(
  request: Request,
  event: PayPalWebhookEvent
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  // In non-production environments, allow unsigned webhooks when webhook id is not configured.
  if (!webhookId) {
    if (isProduction()) {
      console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID is required in production");
      return false;
    }
    return true;
  }

  const authAlgo = request.headers.get("paypal-auth-algo");
  const certUrl = request.headers.get("paypal-cert-url");
  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionSig = request.headers.get("paypal-transmission-sig");
  const transmissionTime = request.headers.get("paypal-transmission-time");

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    console.error("[PayPal Webhook] Missing signature headers");
    return false;
  }

  try {
    const result = await paypalFetch<VerifyWebhookResponse>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    });

    return result.verification_status === "SUCCESS";
  } catch (error) {
    console.error("[PayPal Webhook] signature verification failed", error);
    return false;
  }
}

async function findOrderByPayPalOrderId(paypalOrderId: string): Promise<OrderWebhookLookup | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, paypal_order_id, payment_reference")
    .or(`paypal_order_id.eq.${paypalOrderId},payment_reference.eq.${paypalOrderId}`)
    .limit(1)
    .maybeSingle<OrderWebhookLookup>();

  if (error) {
    console.error("[PayPal Webhook] order lookup error", error);
    return null;
  }

  return data ?? null;
}

async function findOrderByReferenceId(referenceId: string): Promise<OrderWebhookLookup | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, paypal_order_id, payment_reference")
    .eq("id", referenceId)
    .maybeSingle<OrderWebhookLookup>();

  if (error) {
    console.error("[PayPal Webhook] reference order lookup error", error);
    return null;
  }

  return data ?? null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let event: PayPalWebhookEvent;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const isSignatureValid = await verifyWebhookSignature(request, event);
    if (!isSignatureValid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    console.log(`[PayPal Webhook] ${event.event_type}`, event.id);

    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED": {
        const paypalOrderId = event.resource.id;
        if (paypalOrderId) {
          const order = await findOrderByPayPalOrderId(paypalOrderId);
          if (order?.status === "pending_payment") {
            console.log(`[PayPal Webhook] Order ${order.id} approved, waiting for capture`);
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        const captureId = event.resource.id;
        const paypalOrderId = event.resource.supplementary_data?.related_ids?.order_id;
        const referenceId = event.resource.purchase_units?.[0]?.reference_id;

        let order: OrderWebhookLookup | null = null;
        if (paypalOrderId) {
          order = await findOrderByPayPalOrderId(paypalOrderId);
        }
        if (!order && referenceId) {
          order = await findOrderByReferenceId(referenceId);
        }

        if (!order) {
          console.warn("[PayPal Webhook] No local order found for capture", {
            paypalOrderId,
            referenceId,
            captureId,
          });
          break;
        }

        await finalizeOrderPayment({
          orderId: order.id,
          provider: "paypal",
          paymentReference: paypalOrderId || order.paypal_order_id || order.payment_reference || captureId || "",
          actorId: null,
          source: "webhook.paypal.capture_completed",
        });
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        const paypalOrderId = event.resource.supplementary_data?.related_ids?.order_id;
        const referenceId = event.resource.purchase_units?.[0]?.reference_id;

        let order: OrderWebhookLookup | null = null;
        if (paypalOrderId) {
          order = await findOrderByPayPalOrderId(paypalOrderId);
        }
        if (!order && referenceId) {
          order = await findOrderByReferenceId(referenceId);
        }

        if (order) {
          const failReason = event.summary || "PayPal payment capture denied";
          await markOrderPaymentFailed({
            orderId: order.id,
            provider: "paypal",
            paymentReference: paypalOrderId || order.paypal_order_id || order.payment_reference || event.resource.id || "",
            reason: failReason,
            source: "webhook.paypal.capture_denied",
          });

          await supabaseAdmin.from("order_events").insert({
            order_id: order.id,
            event_type: "payment",
            metadata: {
              action: "payment_failed",
              provider: "paypal",
              reason: failReason,
              webhook_event_id: event.id,
            },
          });
        }
        break;
      }

      case "PAYMENT.AUTHORIZATION.CREATED": {
        console.log(`[PayPal Webhook] Authorization created: ${event.resource.id}`);
        break;
      }

      case "MERCHANT.ONBOARDING.COMPLETED": {
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
