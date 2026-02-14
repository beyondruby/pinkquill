import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { finalizeOrderPayment, markOrderPaymentFailed } from "@/lib/payments-server";
import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

type OrderForConfirm = {
  id: string;
  buyer_id: string;
  status: string;
  listing_type: string;
  shipping_address: Record<string, unknown> | null;
  amount: number;
  currency: string;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_intent_id: string | null;
  product: {
    delivery_type: string;
  } | null;
};

export const runtime = "nodejs";

function resolveProviderForOrder(order: OrderForConfirm, orderAmount: number): PaymentProvider {
  // Payable orders must always use a real provider-backed confirmation path.
  if (orderAmount > 0) {
    return "stripe";
  }

  if (order.payment_provider === "placeholder" || order.payment_reference?.startsWith("placeholder:")) {
    return "placeholder";
  }

  if (order.payment_intent_id && order.payment_intent_id.startsWith("pi_")) {
    return "stripe";
  }

  return getPaymentProvider();
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "payments.confirm",
      limit: 45,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<{ order_id?: string }>(request);
    if ("error" in parsed) return parsed.error;
    const { order_id: orderId } = parsed.data;
    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        buyer_id,
        status,
        listing_type,
        shipping_address,
        amount,
        currency,
        payment_provider,
        payment_reference,
        payment_intent_id,
        product:products (delivery_type)
      `)
      .eq("id", orderId)
      .single<OrderForConfirm>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Idempotent success for already processed orders.
    if (order.status !== "pending_payment") {
      return NextResponse.json({
        success: true,
        already_processed: true,
        status: order.status,
      });
    }

    const requiresShippingDetails =
      order.listing_type === "product"
      && order.product?.delivery_type !== "digital"
      && !order.shipping_address;

    if (requiresShippingDetails) {
      return NextResponse.json(
        { error: "Shipping details are required before payment confirmation." },
        { status: 400 }
      );
    }

    const orderAmount = Number(order.amount);
    if (!Number.isFinite(orderAmount) || orderAmount < 0) {
      return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
    }

    const providerName = resolveProviderForOrder(order, orderAmount);

    // For Stripe: verify PaymentIntent status via provider
    if (providerName === "stripe") {
      if (!order.payment_intent_id || !order.payment_intent_id.startsWith("pi_")) {
        return NextResponse.json({ error: "Missing Stripe payment intent for this order" }, { status: 400 });
      }

      // Use Stripe SDK directly to check status (provider.capturePayment validates)
      const { getStripeServer } = await import("@/lib/stripe");
      const stripe = getStripeServer();
      const paymentIntent = await stripe.paymentIntents.retrieve(order.payment_intent_id);
      const expectedAmount = Math.round(orderAmount * 100);
      const orderCurrency = String(order.currency || "usd").toLowerCase();
      const intentCurrency = String(paymentIntent.currency || "").toLowerCase();

      if (paymentIntent.metadata?.order_id && paymentIntent.metadata.order_id !== order.id) {
        return NextResponse.json(
          { error: "Payment intent does not belong to this order. Please restart checkout." },
          { status: 409 }
        );
      }

      if (paymentIntent.amount !== expectedAmount || intentCurrency !== orderCurrency) {
        return NextResponse.json(
          { error: "Payment intent does not match this order total. Please restart checkout." },
          { status: 409 }
        );
      }

      // succeeded = auto-capture (products), requires_capture = manual capture (commissions/escrow)
      if (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture") {
        const result = await finalizeOrderPayment({
          orderId: order.id,
          provider: "stripe",
          paymentReference: paymentIntent.id,
          actorId: user.id,
          source: "api.payments.confirm",
        });

        return NextResponse.json({
          success: true,
          provider: "stripe",
          already_processed: result.already_processed,
          status: result.status,
          payment_status: result.payment_status,
        });
      }

      if (paymentIntent.status === "canceled" || paymentIntent.status === "requires_payment_method") {
        await markOrderPaymentFailed({
          orderId: order.id,
          provider: "stripe",
          paymentReference: paymentIntent.id,
          reason: paymentIntent.last_payment_error?.message || "Stripe payment failed",
          source: "api.payments.confirm",
        });

        return NextResponse.json(
          {
            error: paymentIntent.last_payment_error?.message || "Payment failed. Please try again.",
            payment_intent_status: paymentIntent.status,
          },
          { status: 402 }
        );
      }

      return NextResponse.json(
        {
          error: `Payment is not complete yet (status: ${paymentIntent.status})`,
          payment_intent_status: paymentIntent.status,
        },
        { status: 409 }
      );
    }

    if (orderAmount > 0) {
      return NextResponse.json(
        { error: "Payable orders must be confirmed through Stripe checkout." },
        { status: 409 }
      );
    }

    // Placeholder flow
    const paymentReference = order.payment_reference || `placeholder:${order.id}`;
    const result = await finalizeOrderPayment({
      orderId: order.id,
      provider: "placeholder",
      paymentReference,
      actorId: user.id,
      source: "api.payments.confirm",
    });

    return NextResponse.json({
      success: true,
      provider: "placeholder",
      already_processed: result.already_processed,
      status: result.status,
      payment_status: result.payment_status,
    });
  } catch (error) {
    console.error("[Payments Confirm]", error);
    const message = error instanceof Error ? error.message : "Failed to confirm payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
