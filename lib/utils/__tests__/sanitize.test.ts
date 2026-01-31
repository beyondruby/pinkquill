import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  stripHtml,
  getExcerpt,
  getExcerptByWords,
  countWords,
  sanitizeUrl,
  createSafeHtml,
} from "../sanitize";

describe("sanitizeHtml", () => {
  it("should allow safe HTML tags", () => {
    const input = "<p>Hello <strong>world</strong></p>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<p>");
    expect(result).toContain("<strong>");
  });

  it("should remove script tags (XSS prevention)", () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("should remove onclick handlers (XSS prevention)", () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
  });

  it("should remove javascript: URLs (XSS prevention)", () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("should replace &nbsp; with regular space", () => {
    const input = "<p>Hello&nbsp;world</p>";
    const result = sanitizeHtml(input);
    expect(result).toBe("<p>Hello world</p>");
  });

  it("should return empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("stripHtml", () => {
  it("should remove all HTML tags", () => {
    const input = "<p>Hello <strong>world</strong></p>";
    const result = stripHtml(input);
    expect(result).toBe("Hello world");
  });

  it("should decode HTML entities", () => {
    const input = "<p>Hello &amp; goodbye &lt;world&gt;</p>";
    const result = stripHtml(input);
    expect(result).toBe("Hello & goodbye <world>");
  });

  it("should handle &nbsp;", () => {
    const input = "<p>Hello&nbsp;world</p>";
    const result = stripHtml(input);
    expect(result).toBe("Hello world");
  });

  it("should return empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("should handle nested tags", () => {
    const input = "<div><p><span>Nested</span> content</p></div>";
    const result = stripHtml(input);
    expect(result).toBe("Nested content");
  });
});

describe("getExcerpt", () => {
  it("should truncate text to specified length", () => {
    const input = "<p>This is a very long text that needs to be truncated</p>";
    const result = getExcerpt(input, 20);
    expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
    expect(result).toContain("...");
  });

  it("should not truncate short text", () => {
    const input = "<p>Short</p>";
    const result = getExcerpt(input, 100);
    expect(result).toBe("Short");
    expect(result).not.toContain("...");
  });

  it("should strip HTML before truncating", () => {
    const input = "<p><strong>Bold</strong> text</p>";
    const result = getExcerpt(input, 100);
    expect(result).toBe("Bold text");
  });
});

describe("getExcerptByWords", () => {
  it("should truncate by word count", () => {
    const input = "<p>One two three four five six seven</p>";
    const result = getExcerptByWords(input, 3);
    expect(result.text).toBe("One two three...");
    expect(result.isTruncated).toBe(true);
  });

  it("should not truncate if fewer words than max", () => {
    const input = "<p>One two</p>";
    const result = getExcerptByWords(input, 5);
    expect(result.text).toBe("One two");
    expect(result.isTruncated).toBe(false);
  });

  it("should handle exact word count", () => {
    const input = "<p>One two three</p>";
    const result = getExcerptByWords(input, 3);
    expect(result.text).toBe("One two three");
    expect(result.isTruncated).toBe(false);
  });
});

describe("countWords", () => {
  it("should count words in plain text", () => {
    const input = "One two three four";
    expect(countWords(input)).toBe(4);
  });

  it("should count words in HTML", () => {
    const input = "<p>One <strong>two</strong> three</p>";
    expect(countWords(input)).toBe(3);
  });

  it("should handle multiple spaces", () => {
    const input = "One   two    three";
    expect(countWords(input)).toBe(3);
  });

  it("should return 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("sanitizeUrl", () => {
  it("should allow https URLs", () => {
    const input = "https://example.com";
    expect(sanitizeUrl(input)).toBe(input);
  });

  it("should allow http URLs", () => {
    const input = "http://example.com";
    expect(sanitizeUrl(input)).toBe(input);
  });

  it("should block javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("should block data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("should block vbscript: URLs", () => {
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("");
  });

  it("should be case insensitive for dangerous protocols", () => {
    expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("");
    expect(sanitizeUrl("JavaScript:alert(1)")).toBe("");
  });

  it("should return empty for empty input", () => {
    expect(sanitizeUrl("")).toBe("");
  });
});

describe("createSafeHtml", () => {
  it("should return object for dangerouslySetInnerHTML", () => {
    const input = "<p>Hello</p>";
    const result = createSafeHtml(input);
    expect(result).toHaveProperty("__html");
    expect(result.__html).toBe("<p>Hello</p>");
  });

  it("should sanitize the HTML", () => {
    const input = '<p onclick="alert(1)">Click</p>';
    const result = createSafeHtml(input);
    expect(result.__html).not.toContain("onclick");
  });
});
