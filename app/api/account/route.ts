import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "user",
      identifier: user.id,
      limit: 3,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 3600);

    const parsed = await safeJsonParse<{ confirmation?: string }>(request);
    if ("error" in parsed) return parsed.error;

    if (parsed.data?.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm account removal." },
        { status: 400 }
      );
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (authDeleteError) {
      console.error("[DELETE /api/account] Failed to delete auth user:", authDeleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileDeleteError) {
      console.error("[DELETE /api/account] Failed to delete profile:", profileDeleteError);
      return NextResponse.json(
        { error: "Your sign-in was removed, but profile cleanup needs support assistance." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/account] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
