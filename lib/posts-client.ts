"use client";

import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { safeResponseJson } from "@/lib/utils/fetch";

interface DeleteOwnPostResponse {
  success?: boolean;
  error?: string;
}

export async function deleteOwnPost(postId: string): Promise<void> {
  const response = await fetch("/api/posts/delete", {
    method: "POST",
    headers: await buildAuthenticatedHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ post_id: postId }),
  });

  const data = await safeResponseJson<DeleteOwnPostResponse>(response);

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to delete post");
  }
}
