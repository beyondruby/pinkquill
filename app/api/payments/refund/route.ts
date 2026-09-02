/**
 * POST /api/payments/refund — buyer/seller/admin refund & cancellation actions.
 *
 * Body: { order_id, action, reason?, amount?, refund_id?, note? }
 *   action = "request"  buyer asks for a refund (amount in USD, omit = full)
 *          = "approve" | "decline"  seller/admin decides the open request
 *          = "issue"    seller/admin refunds proactively (amount in USD, omit = full)
 *          = "cancel"   either side cancels per policy D6
 *
 * Decisions are made by SECURITY DEFINER RPCs running as the caller; money
 * moves only through lib/refunds-server.ts afterwards.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient, getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { executeApprovedRefunds } from "@/lib/refunds-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Action = "request" | "approve" | "decline" | "issue" | "cancel";

function toListingCents(amount: unknown): number | null {
  if (amount === undefined || amount === null || amount === "") return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

function statusFor(message: string): number {
  return /not authorized|not authenticated/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit({ request, scope: "payments.refund", limit: 12, windowSeconds: 60, userId: user.id });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

  const parsed = await safeJsonParse<{
    order_id?: string; action?: Action; reason?: string; amount?: number | string; refund_id?: string; note?: string;
  }>(request);
  if ("error" in parsed) return parsed.error;
  const { order_id, action, reason, amount, refund_id, note } = parsed.data;
  if (!order_id) return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();

  try {
    let result: unknown;
    switch (action) {
      case "request": {
        const { data, error } = await supabase.rpc("request_order_refund", {
          p_order_id: order_id, p_listing_cents: toListingCents(amount), p_reason: reason ?? null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      case "approve":
      case "decline": {
        let id = refund_id;
        if (!id) {
          const { data: open } = await supabaseAdmin
            .from("refunds").select("id").eq("order_id", order_id).eq("status", "requested")
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          id = open?.id as string | undefined;
        }
        if (!id) return NextResponse.json({ error: "No refund request to decide" }, { status: 400 });
        const { data, error } = await supabase.rpc("decide_refund_request", {
          p_refund_id: id, p_approve: action === "approve", p_note: note ?? reason ?? null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      case "issue": {
        const { data, error } = await supabase.rpc("issue_order_refund", {
          p_order_id: order_id, p_listing_cents: toListingCents(amount), p_reason: reason ?? null,
        });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      case "cancel": {
        const { data, error } = await supabase.rpc("cancel_order", { p_order_id: order_id, p_reason: reason ?? null });
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Move any money that was just approved. Failures park the refund for review
    // and the worker retries; the caller still gets the decision result.
    const execution = await executeApprovedRefunds(order_id, 5).catch((err) => {
      console.error("[refund route] execution error:", err);
      return null;
    });

    return NextResponse.json({ success: true, result, execution });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
