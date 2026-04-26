import { NextResponse } from "next/server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { createSupabaseServerClient, getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface DownloadPayload {
  token?: string;
}

interface ConsumeResult {
  file_url: string;
  file_name: string;
  downloads_used: number;
  downloads_remaining: number | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes — long enough to start a download, short enough to be useless if leaked

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
      scope: "orders.download",
      userId: user.id,
      limit: 30,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<DownloadPayload>(request);
    if ("error" in parsed) return parsed.error;

    const token = String(parsed.data.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    // Use the cookie-bound user client so consume_download_token can
    // enforce auth.uid() === order.buyer_id. Falling through to the admin
    // client here would bypass the buyer check.
    const userClient = await createSupabaseServerClient();
    const { data, error } = await userClient.rpc("consume_download_token", { p_token: token });

    if (error) {
      const message = error.message || "Failed to consume download token";
      // Most failures (expired, wrong user, exhausted) are user-actionable.
      // Authentication failure → 401; everything else → 400.
      const status = /not authenticated/i.test(message) ? 401 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    const result = data as ConsumeResult | null;
    if (!result?.file_url) {
      return NextResponse.json({ error: "Download token has no associated file" }, { status: 500 });
    }

    // The RPC returns the bare storage path (post-migration). Mint a
    // short-lived signed URL via the admin client so the buyer can
    // download without ever seeing a long-lived token.
    const path = result.file_url;
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("product-files")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: result.file_name });

    if (signError || !signed?.signedUrl) {
      console.error("[POST /api/orders/download] Failed to sign URL:", signError);
      return NextResponse.json({ error: "Failed to prepare download" }, { status: 500 });
    }

    return NextResponse.json({
      url: signed.signedUrl,
      file_name: result.file_name,
      downloads_used: result.downloads_used,
      downloads_remaining: result.downloads_remaining,
      expires_in: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[POST /api/orders/download] Error:", error);
    return NextResponse.json({ error: "Failed to prepare download" }, { status: 500 });
  }
}
