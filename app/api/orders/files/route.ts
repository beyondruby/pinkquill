import { NextResponse } from "next/server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface FilesPayload {
  order_id?: string;
  paths?: string[];
}

const BUCKET = "order-files";
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes

/**
 * Normalize an attachment reference to a bare storage key.
 * Accepts both the new format (bare path) and the legacy format
 * (full public URL containing `/order-files/`) so historical
 * delivery rows keep resolving after the bucket is made private.
 */
function toStorageKey(ref: string): string | null {
  if (!ref) return null;
  const marker = `/${BUCKET}/`;
  const idx = ref.indexOf(marker);
  const key = idx >= 0 ? ref.slice(idx + marker.length) : ref;
  // Strip any query string and leading slashes.
  const clean = key.split("?")[0].replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return null;
  return clean;
}

/**
 * Mint short-lived signed URLs for order delivery files in the (private)
 * order-files bucket. Authorization: the caller must be the buyer or seller
 * of the order the files belong to.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "orders.files",
      userId: user.id,
      limit: 60,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const parsed = await safeJsonParse<FilesPayload>(request);
    if ("error" in parsed) return parsed.error;

    const orderId = String(parsed.data.order_id || "").trim();
    const paths = Array.isArray(parsed.data.paths) ? parsed.data.paths : [];
    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }
    if (paths.length === 0) {
      return NextResponse.json({ urls: {} });
    }
    if (paths.length > 50) {
      return NextResponse.json({ error: "Too many files requested" }, { status: 400 });
    }

    // Authorize: caller must be a participant in the order.
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Files for this order live under `orders/<orderId>/`. Reject any key that
    // escapes that prefix so a participant can't sign another order's files.
    const expectedPrefix = `orders/${orderId}/`;
    const urls: Record<string, string> = {};

    for (const ref of paths) {
      const key = toStorageKey(ref);
      if (!key || !key.startsWith(expectedPrefix)) continue;
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
      if (signed?.signedUrl) urls[ref] = signed.signedUrl;
    }

    return NextResponse.json({ urls, expires_in: SIGNED_URL_TTL_SECONDS });
  } catch (error) {
    console.error("[POST /api/orders/files] Error:", error);
    return NextResponse.json({ error: "Failed to prepare files" }, { status: 500 });
  }
}
