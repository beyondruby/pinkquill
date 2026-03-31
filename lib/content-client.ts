"use client";

import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { safeResponseJson } from "@/lib/utils/fetch";

type DeleteOutcome = "deleted";
export type DeleteListingOutcome = "deleted" | "archived";

interface DeleteResponseBase {
  success?: boolean;
  error?: string;
}

interface DeletePostResponse extends DeleteResponseBase {
  post_id?: string;
  outcome?: DeleteOutcome;
}

interface DeleteTakeResponse extends DeleteResponseBase {
  take_id?: string;
  outcome?: DeleteOutcome;
}

interface DeleteListingResponse extends DeleteResponseBase {
  listing_id?: string;
  listing_type?: string;
  outcome?: DeleteListingOutcome;
}

export interface DeleteListingResult {
  listingId: string;
  listingType?: string;
  outcome: DeleteListingOutcome;
}

async function requestDelete<T extends DeleteResponseBase>(
  url: string,
  body: Record<string, string>
): Promise<T> {
  const resolvedUrl =
    typeof window !== "undefined" && window.location?.origin
      ? new URL(url, window.location.origin).toString()
      : url;

  const response = await fetch(resolvedUrl, {
    method: "POST",
    headers: await buildAuthenticatedHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  const data = await safeResponseJson<T>(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Delete request failed");
  }

  return data;
}

export async function deleteOwnPost(postId: string): Promise<void> {
  await requestDelete<DeletePostResponse>("/api/posts/delete", { post_id: postId });
}

export async function deleteOwnTake(takeId: string): Promise<void> {
  await requestDelete<DeleteTakeResponse>("/api/takes/delete", { take_id: takeId });
}

export async function deleteOwnListing(listingId: string): Promise<DeleteListingResult> {
  const data = await requestDelete<DeleteListingResponse>("/api/listings/delete", {
    listing_id: listingId,
  });

  return {
    listingId: data.listing_id || listingId,
    listingType: data.listing_type,
    outcome: data.outcome || "deleted",
  };
}
