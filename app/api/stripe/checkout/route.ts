import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { order_id: orderId } = body as { order_id?: string };

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_provider, payment_reference")
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
      return NextResponse.json(
        {
          error: "Stripe is currently disabled while account setup is pending. Use placeholder mode for now.",
        },
        { status: 503 }
      );
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
