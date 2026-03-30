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

interface DeleteListingBody {
  listing_id?: string;
}

type ListingType = "product" | "service";
type ListingOutcome = "deleted" | "archived";

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
      identifier: `${user.id}:listing_delete`,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const parsed = await safeJsonParse<DeleteListingBody>(request);
    if ("error" in parsed) return parsed.error;

    const listingId = parsed.data?.listing_id?.trim();
    if (!listingId) {
      return NextResponse.json({ error: "listing_id is required" }, { status: 400 });
    }

    const { data: listing, error: listingError } = await supabaseAdmin
      .from("products")
      .select("id, seller_id, listing_type")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.seller_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this listing" }, { status: 403 });
    }

    const listingType = (listing.listing_type || "product") as ListingType;

    const [{ data: mediaRows, error: mediaError }, { data: fileRows, error: filesError }] =
      await Promise.all([
        supabaseAdmin
          .from("product_media")
          .select("media_url")
          .eq("product_id", listingId),
        supabaseAdmin
          .from("product_files")
          .select("file_url")
          .eq("product_id", listingId),
      ]);

    if (mediaError || filesError) {
      console.error("[POST /api/listings/delete] Failed to load listing assets:", mediaError || filesError);
      return NextResponse.json({ error: "Failed to delete listing" }, { status: 500 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", listingId)
      .eq("seller_id", user.id);

    let outcome: ListingOutcome = "deleted";

    if (deleteError) {
      if (deleteError.code === "23503") {
        const { error: archiveError } = await supabaseAdmin
          .from("products")
          .update({
            status: "archived",
            updated_at: new Date().toISOString(),
          })
          .eq("id", listingId)
          .eq("seller_id", user.id);

        if (archiveError) {
          console.error("[POST /api/listings/delete] Failed to archive listing:", archiveError);
          return NextResponse.json({ error: "Failed to archive listing" }, { status: 500 });
        }

        outcome = "archived";
      } else {
        console.error("[POST /api/listings/delete] Failed to delete listing:", deleteError);
        return NextResponse.json({ error: "Failed to delete listing" }, { status: 500 });
      }
    }

    if (outcome === "deleted") {
      const mediaPaths = (mediaRows || [])
        .map((row) => extractStorageObjectPath(row.media_url, "product-images"))
        .filter((path): path is string => Boolean(path));

      if (mediaPaths.length > 0) {
        supabaseAdmin.storage
          .from("product-images")
          .remove(mediaPaths)
          .then(({ error }) => {
            if (error) {
              console.error("[POST /api/listings/delete] Failed to remove product images:", error);
            }
          });
      }

      const filePaths = (fileRows || [])
        .map((row) => extractStorageObjectPath(row.file_url, "product-files"))
        .filter((path): path is string => Boolean(path));

      if (filePaths.length > 0) {
        supabaseAdmin.storage
          .from("product-files")
          .remove(filePaths)
          .then(({ error }) => {
            if (error) {
              console.error("[POST /api/listings/delete] Failed to remove product files:", error);
            }
          });
      }
    }

    return NextResponse.json({
      success: true,
      listing_id: listingId,
      listing_type: listingType,
      outcome,
    });
  } catch (error) {
    console.error("[POST /api/listings/delete] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
