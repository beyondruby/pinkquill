import { describe, it, expect } from "vitest";
import {
  isSupabaseStorageUrl,
  getOptimizedAvatarUrl,
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
    expect(isSupabaseStorageUrl(null as unknown as string)).toBe(false);
    expect(isSupabaseStorageUrl(undefined as unknown as string)).toBe(false);
  });
});

describe("getOptimizedAvatarUrl", () => {
  const supabaseUrl =
    "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";

  it("should return the original URL unchanged", () => {
    const result = getOptimizedAvatarUrl(supabaseUrl);
    expect(result).toBe(supabaseUrl);
  });

  it("should return empty string for null/undefined", () => {
    expect(getOptimizedAvatarUrl(null)).toBe("");
    expect(getOptimizedAvatarUrl(undefined)).toBe("");
  });
});

describe("getAvatarUrl", () => {
  const supabaseUrl =
    "https://loaitxbibjftsytlgddi.supabase.co/storage/v1/object/public/avatars/test.jpg";

  it("should return the original URL for valid URLs", () => {
    const result = getAvatarUrl(supabaseUrl);
    expect(result).toBe(supabaseUrl);
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
