import { describe, it, expect } from "vitest";
import {
  isSupabaseStorageUrl,
  getOptimizedImageUrl,
  getOptimizedAvatarUrl,
  getAvatarSrcSet,
  getAvatarUrl,
  AVATAR_SIZES,
  DEFAULT_AVATAR,
} from "../image";

describe("isSupabaseStorageUrl", () => {
  it("should return true for Supabase storage URLs", () => {
    const url =
      "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";
    expect(isSupabaseStorageUrl(url)).toBe(true);
  });

  it("should return false for non-Supabase URLs", () => {
    expect(isSupabaseStorageUrl("https://example.com/image.jpg")).toBe(false);
    expect(isSupabaseStorageUrl("/defaultprofile.png")).toBe(false);
    expect(isSupabaseStorageUrl("")).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isSupabaseStorageUrl(null as any)).toBe(false);
    expect(isSupabaseStorageUrl(undefined as any)).toBe(false);
  });
});

describe("getOptimizedImageUrl", () => {
  const supabaseUrl =
    "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";

  it("should convert object URL to render URL", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { width: 100 });
    expect(result).toContain("/storage/v1/render/image/public/");
    expect(result).not.toContain("/storage/v1/object/public/");
  });

  it("should add width parameter", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { width: 200 });
    expect(result).toContain("width=200");
  });

  it("should add height parameter", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { height: 150 });
    expect(result).toContain("height=150");
  });

  it("should add quality parameter with default of 75", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { width: 100 });
    expect(result).toContain("quality=75");
  });

  it("should use custom quality", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { width: 100, quality: 50 });
    expect(result).toContain("quality=50");
  });

  it("should add resize parameter when not cover", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { resize: "contain" });
    expect(result).toContain("resize=contain");
  });

  it("should not add resize parameter when cover (default)", () => {
    const result = getOptimizedImageUrl(supabaseUrl, { width: 100 });
    expect(result).not.toContain("resize=");
  });

  it("should return non-Supabase URLs unchanged", () => {
    const url = "https://example.com/image.jpg";
    expect(getOptimizedImageUrl(url, { width: 100 })).toBe(url);
  });

  it("should return empty string for null/undefined", () => {
    expect(getOptimizedImageUrl(null)).toBe("");
    expect(getOptimizedImageUrl(undefined)).toBe("");
  });
});

describe("getOptimizedAvatarUrl", () => {
  const supabaseUrl =
    "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";

  it("should request 2x size for retina displays", () => {
    // md = 40px, so should request 80px
    const result = getOptimizedAvatarUrl(supabaseUrl, "md");
    expect(result).toContain("width=80");
    expect(result).toContain("height=80");
  });

  it("should work with numeric sizes", () => {
    const result = getOptimizedAvatarUrl(supabaseUrl, 50);
    expect(result).toContain("width=100"); // 50 * 2
  });

  it("should use quality of 80 for avatars", () => {
    const result = getOptimizedAvatarUrl(supabaseUrl, "md");
    expect(result).toContain("quality=80");
  });
});

describe("getAvatarSrcSet", () => {
  const supabaseUrl =
    "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";

  it("should generate srcSet for 1x, 2x, 3x", () => {
    const result = getAvatarSrcSet(supabaseUrl, 40);
    expect(result).toContain("1x");
    expect(result).toContain("2x");
    expect(result).toContain("3x");
  });

  it("should use correct sizes for each density", () => {
    const result = getAvatarSrcSet(supabaseUrl, 40);
    expect(result).toContain("width=40"); // 1x
    expect(result).toContain("width=80"); // 2x
    expect(result).toContain("width=120"); // 3x
  });

  it("should return empty string for non-Supabase URLs", () => {
    expect(getAvatarSrcSet("https://example.com/img.jpg", 40)).toBe("");
    expect(getAvatarSrcSet(null, 40)).toBe("");
  });
});

describe("getAvatarUrl", () => {
  const supabaseUrl =
    "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";

  it("should return optimized URL for Supabase URLs", () => {
    const result = getAvatarUrl(supabaseUrl, "md");
    expect(result).toContain("/render/image/");
  });

  it("should return DEFAULT_AVATAR for null/undefined", () => {
    expect(getAvatarUrl(null)).toBe(DEFAULT_AVATAR);
    expect(getAvatarUrl(undefined)).toBe(DEFAULT_AVATAR);
  });
});

describe("AVATAR_SIZES", () => {
  it("should have standard size definitions", () => {
    expect(AVATAR_SIZES.xs).toBe(24);
    expect(AVATAR_SIZES.sm).toBe(32);
    expect(AVATAR_SIZES.md).toBe(40);
    expect(AVATAR_SIZES.lg).toBe(48);
    expect(AVATAR_SIZES.xl).toBe(64);
    expect(AVATAR_SIZES["2xl"]).toBe(80);
    expect(AVATAR_SIZES["3xl"]).toBe(128);
    expect(AVATAR_SIZES["4xl"]).toBe(160);
  });
});
