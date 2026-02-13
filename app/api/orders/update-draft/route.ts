import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

interface UpdateOrderDraftPayload {
  order_id?: string;
  shipping_address?: Record<string, unknown>;
  buyer_phone?: string;
  buyer_note?: string;
  brief?: string;
  requirements?: Record<string, unknown>;
  due_date?: string;
}

interface OrderForDraftUpdate {
  id: string;
  buyer_id: string;
  status: string;
  listing_type: string;
  shipping_address: Record<string, unknown> | null;
  product: { delivery_type: string } | null;
}

const ALLOWED_STATUSES = new Set(["pending_acceptance", "pending_payment"]);

function parseShippingAddress(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const normalized = {
    name: String(raw.name || "").trim(),
    line1: String(raw.line1 || "").trim(),
    line2: String(raw.line2 || "").trim(),
    city: String(raw.city || "").trim(),
    state: String(raw.state || "").trim(),
    postal_code: String(raw.postal_code || "").trim(),
    country: String(raw.country || "").trim(),
  };

  if (!normalized.name || !normalized.line1 || !normalized.city || !normalized.country) {
    return null;
  }

  return normalized;
}

function parseDueDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
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
      scope: "orders.update_draft",
      limit: 60,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<UpdateOrderDraftPayload>(request);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (!body.order_id) {
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
        product:products (delivery_type)
      `)
      .eq("id", body.order_id)
      .single<OrderForDraftUpdate>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (!ALLOWED_STATUSES.has(order.status)) {
      return NextResponse.json({ error: "Order details can only be edited before payment" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let hasEditableField = false;

    const isPhysicalProduct =
      order.listing_type === "product" && order.product?.delivery_type !== "digital";

    if (isPhysicalProduct) {
      if (body.shipping_address !== undefined) {
        const shippingAddress = parseShippingAddress(body.shipping_address);
        if (!shippingAddress) {
          return NextResponse.json(
            { error: "Shipping address is incomplete. Name, line1, city, and country are required." },
            { status: 400 }
          );
        }
        updates.shipping_address = shippingAddress;
        hasEditableField = true;
      }

      if (body.buyer_phone !== undefined) {
        const phone = String(body.buyer_phone || "").trim();
        if (!phone) {
          return NextResponse.json({ error: "Phone number is required for physical products." }, { status: 400 });
        }
        updates.buyer_phone = phone;
        hasEditableField = true;
      }
    }

    // buyer_note is optional for all order types
    if (body.buyer_note !== undefined) {
      const note = String(body.buyer_note || "").trim();
      if (note.length > 500) {
        return NextResponse.json({ error: "Note to seller must be 500 characters or less." }, { status: 400 });
      }
      updates.buyer_note = note || null;
      hasEditableField = true;
    }

    if (order.listing_type === "service") {
      if (body.brief !== undefined) {
        const brief = String(body.brief || "").trim();
        if (!brief) {
          return NextResponse.json({ error: "Brief cannot be empty." }, { status: 400 });
        }
        updates.brief = brief;
        hasEditableField = true;
      }

      if (body.requirements !== undefined) {
        if (typeof body.requirements !== "object" || body.requirements === null || Array.isArray(body.requirements)) {
          return NextResponse.json({ error: "requirements must be an object." }, { status: 400 });
        }
        updates.requirements = body.requirements;
        hasEditableField = true;
      }

      if (body.due_date !== undefined) {
        const dueDate = parseDueDate(body.due_date);
        if (!dueDate) {
          return NextResponse.json({ error: "Invalid due_date format." }, { status: 400 });
        }
        updates.due_date = dueDate;
        hasEditableField = true;
      }
    }

    if (!hasEditableField) {
      return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Failed to update order draft" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Order Draft Update]", error);
    const message = error instanceof Error ? error.message : "Failed to update order draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
