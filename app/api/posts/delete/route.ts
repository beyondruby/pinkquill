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
      scope: "posts.delete",
      identifier: user.id,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const parsed = await safeJsonParse<{ post_id?: string }>(request);
    if ("error" in parsed) return parsed.error;

    const postId = parsed.data?.post_id?.trim();
    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("id, author_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.author_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this post" }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", user.id);

    if (deleteError) {
      console.error("[POST /api/posts/delete] Failed to delete post:", deleteError);
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }

    return NextResponse.json({ success: true, post_id: postId });
  } catch (error) {
    console.error("[POST /api/posts/delete] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
