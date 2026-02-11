import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { getPaymentProvider } from "@/lib/payments";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

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
      scope: "payments.checkout",
      limit: 30,
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
      .select("id, buyer_id, status, listing_type, amount, currency, payment_provider, payment_reference, payment_intent_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Order is already ${order.status}` },
        { status: 400 }
      );
    }

    const provider = getPaymentProvider();
    if (provider === "stripe") {
      const amountCents = Math.round(Number(order.amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return NextResponse.json({ error: "Order amount is invalid" }, { status: 400 });
      }

      const currency = String(order.currency || "usd").toLowerCase();
      const stripe = getStripeServer();
      const paymentIntentId = order.payment_intent_id && order.payment_intent_id.startsWith("pi_")
        ? order.payment_intent_id
        : null;
      let paymentIntent = paymentIntentId
        ? await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
        : null;

      const reusableStatuses = new Set([
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
        "processing",
      ]);

      if (paymentIntent?.status === "succeeded") {
        return NextResponse.json({ error: "Payment has already been completed for this order" }, { status: 409 });
      }

      if (!paymentIntent || !reusableStatuses.has(paymentIntent.status)) {
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency,
            automatic_payment_methods: { enabled: true },
            metadata: {
              order_id: order.id,
              buyer_id: user.id,
              listing_type: order.listing_type,
            },
            description: `PinkQuill order ${order.id}`,
            receipt_email: user.email ?? undefined,
          },
          { idempotencyKey: `checkout_${order.id}` }
        );
      } else if (paymentIntent.amount !== amountCents || paymentIntent.currency !== currency) {
        paymentIntent = await stripe.paymentIntents.update(paymentIntent.id, {
          amount: amountCents,
          currency,
        });
      }

      if (!paymentIntent.client_secret) {
        return NextResponse.json({ error: "Unable to initialize Stripe checkout" }, { status: 500 });
      }

      await supabaseAdmin
        .from("orders")
        .update({
          payment_provider: "stripe",
          payment_reference: paymentIntent.id,
          payment_intent_id: paymentIntent.id,
          payment_status: "pending",
        })
        .eq("id", orderId);

      return NextResponse.json({
        mode: "stripe",
        client_secret: paymentIntent.client_secret,
        payment_reference: paymentIntent.id,
      });
    }

    const paymentReference = order.payment_reference || `placeholder:${order.id}`;

    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "placeholder",
        payment_reference: paymentReference,
        payment_intent_id: paymentReference,
        payment_status: "pending",
      })
      .eq("id", orderId);

    return NextResponse.json({
      mode: "placeholder",
      client_secret: null,
      payment_reference: paymentReference,
      message: "Placeholder payments are active until Stripe setup is complete.",
    });
  } catch (error) {
    console.error("[Checkout Prepare]", error);
    const message = error instanceof Error ? error.message : "Failed to prepare checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
