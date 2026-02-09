import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { PLATFORM_FEE_RATES } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

interface CreateOrderPayload {
  product_id?: string;
  pricing_id?: string;
  quantity?: number;
  brief?: string;
  requirements?: Record<string, unknown>;
  due_date?: string;
  shipping_address?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateOrderPayload;
    const productId = body.product_id;
    const pricingId = body.pricing_id;
    const requestedQuantity = Number.isFinite(body.quantity) ? Math.max(1, Math.floor(body.quantity!)) : 1;

    if (!productId || !pricingId) {
      return NextResponse.json(
        { error: "product_id and pricing_id are required" },
        { status: 400 }
      );
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, seller_id, listing_type, status, delivery_type")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.status !== "active") {
      return NextResponse.json({ error: "This listing is not available" }, { status: 400 });
    }

    if (product.seller_id === user.id) {
      return NextResponse.json({ error: "You cannot purchase your own listing" }, { status: 400 });
    }

    const { data: pricing, error: pricingError } = await supabaseAdmin
      .from("product_pricing")
      .select("id, price, currency, is_available, stock, revisions, delivery_days")
      .eq("id", pricingId)
      .eq("product_id", productId)
      .single();

    if (pricingError || !pricing) {
      return NextResponse.json({ error: "Pricing option not found" }, { status: 404 });
    }

    if (pricing.is_available === false) {
      return NextResponse.json({ error: "This pricing option is unavailable" }, { status: 400 });
    }

    if (pricing.stock !== null && pricing.stock < requestedQuantity) {
      return NextResponse.json({ error: "Insufficient stock for this quantity" }, { status: 400 });
    }

    const listingType = product.listing_type as "product" | "service";
    const quantity = listingType === "service" ? 1 : requestedQuantity;

    if (listingType === "product" && product.delivery_type !== "digital" && !body.shipping_address) {
      return NextResponse.json({ error: "Shipping address is required for physical orders" }, { status: 400 });
    }

    const unitAmount = Number(pricing.price);
    const amount = Math.round(unitAmount * quantity * 100) / 100;
    const feeRate = PLATFORM_FEE_RATES[listingType];
    const platformFee = Math.round(amount * feeRate * 100) / 100;
    const sellerAmount = Math.round((amount - platformFee) * 100) / 100;
    const currency = String(pricing.currency || "usd").toLowerCase();
    const dueDate = body.due_date && listingType === "service"
      ? body.due_date
      : (pricing.delivery_days
          ? new Date(Date.now() + pricing.delivery_days * 24 * 60 * 60 * 1000).toISOString()
          : null);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: product.seller_id,
        product_id: productId,
        pricing_id: pricingId,
        listing_type: listingType,
        amount,
        platform_fee: platformFee,
        seller_amount: sellerAmount,
        currency,
        status: "pending_payment",
        payment_status: "pending",
        payment_provider: "placeholder",
        brief: listingType === "service" ? (body.brief || null) : null,
        requirements: listingType === "service" ? (body.requirements || {}) : {},
        due_date: listingType === "service" ? dueDate : null,
        max_revisions: listingType === "service" ? (pricing.revisions ?? null) : null,
        quantity,
        shipping_address: listingType === "product" ? (body.shipping_address || null) : null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[Order Create] insert error", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "status_change",
      from_status: null,
      to_status: "pending_payment",
      metadata: { source: "api.orders.create" },
    });

    await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      content: "Order created and ready for payment confirmation.",
      message_type: "system",
    });

    return NextResponse.json({ order_id: order.id });
  } catch (error) {
    console.error("[Order Create]", error);
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
