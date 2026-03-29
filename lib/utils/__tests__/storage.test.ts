import { describe, expect, it } from "vitest";
import { extractStorageObjectPath } from "@/lib/utils/storage";

describe("extractStorageObjectPath", () => {
  it("extracts a public storage object path", () => {
    expect(
      extractStorageObjectPath(
        "https://example.supabase.co/storage/v1/object/public/takes/user-1/video.mp4",
        "takes"
      )
    ).toBe("user-1/video.mp4");
  });

  it("extracts a signed storage object path without query params", () => {
    expect(
      extractStorageObjectPath(
        "https://example.supabase.co/storage/v1/object/sign/product-files/user-1/file.zip?token=abc",
        "product-files"
      )
    ).toBe("user-1/file.zip");
  });

  it("returns null for unrelated buckets", () => {
    expect(
      extractStorageObjectPath(
        "https://example.supabase.co/storage/v1/object/public/takes/user-1/video.mp4",
        "product-images"
      )
    ).toBeNull();
  });

  it("accepts direct bucket-relative storage paths", () => {
    expect(extractStorageObjectPath("takes/user-1/video.mp4", "takes")).toBe("user-1/video.mp4");
  });

  it("accepts raw storage keys without the bucket prefix", () => {
    expect(
      extractStorageObjectPath("user-1/products/file.zip", "product-files")
    ).toBe("user-1/products/file.zip");
  });
});
