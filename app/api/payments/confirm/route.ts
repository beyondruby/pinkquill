import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { finalizeOrderPayment, markOrderPaymentFailed } from "@/lib/payments-server";
import { getPaymentProvider } from "@/lib/payments";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

type OrderForPayment = {
  id: string;
  buyer_id: string;
  status: string;
  payment_reference: string | null;
  payment_intent_id: string | null;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser();
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

    const body = await request.json();
    const { order_id: orderId } = body as { order_id?: string };
    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_reference, payment_intent_id")
      .eq("id", orderId)
      .single<OrderForPayment>();

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

    const provider = getPaymentProvider();
    if (provider === "stripe") {
      if (!order.payment_intent_id || !order.payment_intent_id.startsWith("pi_")) {
        return NextResponse.json({ error: "Missing Stripe payment intent for this order" }, { status: 400 });
      }

      const stripe = getStripeServer();
      const paymentIntent = await stripe.paymentIntents.retrieve(order.payment_intent_id);

      if (paymentIntent.status === "succeeded") {
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
