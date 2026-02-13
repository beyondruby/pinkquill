import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
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

interface ProductOrderSnapshot {
  id: string;
  seller_id: string;
  status: string;
}

function mapCreateOrderError(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes("product not found") || normalized.includes("pricing option not found")) return 404;
  if (normalized.includes("required")) return 400;
  if (
    normalized.includes("insufficient stock") ||
    normalized.includes("unavailable") ||
    normalized.includes("cannot purchase your own") ||
    normalized.includes("not available")
  ) {
    return 400;
  }
  return 500;
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
      scope: "orders.create",
      limit: 30,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<CreateOrderPayload>(request);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
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
      .select("id, seller_id, status")
      .eq("id", productId)
      .maybeSingle<ProductOrderSnapshot>();

    if (productError) {
      console.error("[Order Create] failed to load product", productError);
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.status !== "active") {
      return NextResponse.json({ error: "This listing is not available" }, { status: 400 });
    }

    if (product.seller_id === user.id) {
      console.warn("[Order Create] own listing blocked", {
        buyerId: user.id,
        sellerId: product.seller_id,
        productId,
      });
      return NextResponse.json({ error: "You cannot purchase your own listing" }, { status: 400 });
    }

    const parsedDueDate = body.due_date ? new Date(body.due_date) : null;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: "Invalid due_date format" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("create_marketplace_order", {
      p_buyer_id: user.id,
      p_product_id: productId,
      p_pricing_id: pricingId,
      p_requested_quantity: requestedQuantity,
      p_brief: body.brief ?? null,
      p_requirements: body.requirements ?? {},
      p_due_date: parsedDueDate ? parsedDueDate.toISOString() : null,
      p_shipping_address: body.shipping_address ?? null,
    });

    if (error || !data) {
      const message = error?.message || "Failed to create order";
      console.error("[Order Create RPC] error", error);
      return NextResponse.json({ error: message }, { status: mapCreateOrderError(message) });
    }

    const result = typeof data === "object" && data !== null ? (data as { order_id?: string; status?: string }) : undefined;
    const orderId = result?.order_id;

    if (!orderId) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    return NextResponse.json({
      order_id: orderId,
      status: result?.status ?? "pending_payment",
    });
  } catch (error) {
    console.error("[Order Create]", error);
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
