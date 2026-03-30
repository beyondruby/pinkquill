import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { extractStorageObjectPath } from "@/lib/utils/storage";

export const runtime = "nodejs";

interface DeleteTakeBody {
  take_id?: string;
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
      scope: "user",
      identifier: `${user.id}:take_delete`,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const parsed = await safeJsonParse<DeleteTakeBody>(request);
    if ("error" in parsed) return parsed.error;

    const takeId = parsed.data?.take_id?.trim();
    if (!takeId) {
      return NextResponse.json({ error: "take_id is required" }, { status: 400 });
    }

    const { data: take, error: takeError } = await supabaseAdmin
      .from("takes")
      .select("id, author_id, video_url, thumbnail_url")
      .eq("id", takeId)
      .single();

    if (takeError || !take) {
      return NextResponse.json({ error: "Take not found" }, { status: 404 });
    }

    if (take.author_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this take" }, { status: 403 });
    }

    const { data: takeCommentIds, error: commentsLookupError } = await supabaseAdmin
      .from("take_comments")
      .select("id")
      .eq("take_id", takeId);

    if (commentsLookupError) {
      console.error("[POST /api/takes/delete] Failed to load take comments:", commentsLookupError);
      return NextResponse.json({ error: "Failed to delete take" }, { status: 500 });
    }

    const commentIds = (takeCommentIds || []).map((comment) => comment.id);

    if (commentIds.length > 0) {
      const { error: commentLikesDeleteError } = await supabaseAdmin
        .from("take_comment_likes")
        .delete()
        .in("comment_id", commentIds);

      if (commentLikesDeleteError) {
        console.error("[POST /api/takes/delete] Failed to delete take comment likes:", commentLikesDeleteError);
        return NextResponse.json({ error: "Failed to delete take" }, { status: 500 });
      }
    }

    const deleteOperations = await Promise.all([
      supabaseAdmin.from("take_comments").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_saves").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_relays").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_reactions").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_admires").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_tags").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_mentions").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_collaborators").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_views").delete().eq("take_id", takeId),
      supabaseAdmin.from("take_impressions").delete().eq("take_id", takeId),
      supabaseAdmin.from("notifications").delete().eq("post_id", takeId),
    ]);

    const failedDelete = deleteOperations.find((result) => result.error);
    if (failedDelete?.error) {
      console.error("[POST /api/takes/delete] Failed to delete related take data:", failedDelete.error);
      return NextResponse.json({ error: "Failed to delete take" }, { status: 500 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("takes")
      .delete()
      .eq("id", takeId)
      .eq("author_id", user.id);

    if (deleteError) {
      console.error("[POST /api/takes/delete] Failed to delete take:", deleteError);
      return NextResponse.json({ error: "Failed to delete take" }, { status: 500 });
    }

    const storagePaths = [
      extractStorageObjectPath(take.video_url, "takes"),
      extractStorageObjectPath(take.thumbnail_url, "takes"),
    ].filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      supabaseAdmin.storage
        .from("takes")
        .remove(storagePaths)
        .then(({ error }) => {
          if (error) {
            console.error("[POST /api/takes/delete] Failed to remove take storage assets:", error);
          }
        });
    }

    return NextResponse.json({
      success: true,
      take_id: takeId,
      outcome: "deleted",
    });
  } catch (error) {
    console.error("[POST /api/takes/delete] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete take";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
