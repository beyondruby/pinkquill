import { describe, expect, test } from "vitest";
import { isProtectedPath } from "@/lib/auth/protected-paths";

describe("isProtectedPath", () => {
  test("keeps browseable guest pages public", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/explore")).toBe(false);
    expect(isProtectedPath("/post/123")).toBe(false);
    expect(isProtectedPath("/studio/someone")).toBe(false);
  });

  test("protects pages that require account actions or private data", () => {
    expect(isProtectedPath("/create")).toBe(true);
    expect(isProtectedPath("/messages")).toBe(true);
    expect(isProtectedPath("/saved")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/orders/123")).toBe(true);
    expect(isProtectedPath("/seller/dashboard")).toBe(true);
    expect(isProtectedPath("/insights/content")).toBe(true);
  });
});
