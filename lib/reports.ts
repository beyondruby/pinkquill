import { supabase } from "@/lib/supabase";

export type ReportTarget =
  | {
      type: "post";
      postId: string;
      reportedUserId?: string | null;
      /** Pass `null` when the post is known to have no community; omit to look it up. */
      communityId?: string | null;
    }
  | { type: "take"; takeId: string; reportedUserId: string }
  | { type: "user"; reportedUserId: string };

/**
 * The one insert shape for `reports`, matching the live table
 * (post_id / take_id / reported_user_id / reason / details / type /
 * community_id). Four callers used to write `reported_post_id`, a column
 * that does not exist, and never noticed because the result was discarded
 * (finding V-17). Resolves to true on success; on failure it logs and
 * resolves to false so the caller can toast and keep its dialog open.
 */
export async function submitReport(
  target: ReportTarget,
  reporterId: string,
  reason: string,
  details?: string,
): Promise<boolean> {
  const row: Record<string, unknown> = {
    reporter_id: reporterId,
    reason,
    details: details?.trim() || null,
    type: target.type,
  };

  if (target.type === "user") {
    row.reported_user_id = target.reportedUserId;
  } else if (target.type === "take") {
    row.take_id = target.takeId;
    row.reported_user_id = target.reportedUserId;
  } else {
    row.post_id = target.postId;
    let reportedUserId = target.reportedUserId ?? null;
    let communityId = target.communityId;
    if (!reportedUserId || communityId === undefined) {
      const { data } = await supabase
        .from("posts")
        .select("author_id, community_id")
        .eq("id", target.postId)
        .maybeSingle();
      reportedUserId = reportedUserId || data?.author_id || null;
      if (communityId === undefined) communityId = data?.community_id ?? null;
    }
    row.reported_user_id = reportedUserId;
    if (communityId) row.community_id = communityId;
  }

  const { error } = await supabase.from("reports").insert(row);
  if (error) {
    console.error("[submitReport] Failed:", error.message);
    return false;
  }
  return true;
}
