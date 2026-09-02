import DOMPurify, { Config } from "dompurify";

/**
 * HTML Sanitization utilities for XSS prevention
 * Use these functions instead of manual regex-based HTML stripping
 */

// Default allowed tags for rich text content
const DEFAULT_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "s",
  "a", "ul", "ol", "li", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "span", "div", "pre", "code"
];

// Default allowed attributes. `style` is filtered by the DOMPurify hook below
// so authored post colors/highlights survive without opening arbitrary CSS.
const DEFAULT_ALLOWED_ATTRS = ["href", "target", "rel", "class", "style"];

const SAFE_STYLE_PROPERTIES = new Set([
  "color",
  "background-color",
  "border-radius",
  "padding",
]);

const SAFE_COLOR_VALUE =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*(\d{1,3}%?\s*,\s*){2}\d{1,3}%?(\s*,\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)|hsla?\(\s*\d{1,3}(deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)|transparent)$/i;
const SAFE_LENGTH_VALUE = /^(\d+(\.\d+)?(px|rem|em|%)?|0)$/i;

function isSafeStyleValue(property: string, value: string): boolean {
  const normalizedValue = value.trim();
  const lowerValue = normalizedValue.toLowerCase();

  if (
    !normalizedValue ||
    lowerValue.includes("url(") ||
    lowerValue.includes("expression(") ||
    lowerValue.includes("javascript:") ||
    lowerValue.includes("data:")
  ) {
    return false;
  }

  if (property === "color" || property === "background-color") {
    return SAFE_COLOR_VALUE.test(normalizedValue);
  }

  if (property === "border-radius") {
    return SAFE_LENGTH_VALUE.test(normalizedValue);
  }

  if (property === "padding") {
    const parts = normalizedValue.split(/\s+/);
    return parts.length >= 1 && parts.length <= 4 && parts.every((part) => SAFE_LENGTH_VALUE.test(part));
  }

  return false;
}

function sanitizeInlineStyle(style: string): string {
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex === -1) return "";

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();

      if (!SAFE_STYLE_PROPERTIES.has(property) || !isSafeStyleValue(property, value)) {
        return "";
      }

      return `${property}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

if (typeof DOMPurify.addHook === "function") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const element = node as Element;
    if (
      node.nodeType !== 1 ||
      typeof element.hasAttribute !== "function" ||
      !element.hasAttribute("style")
    ) {
      return;
    }

    const safeStyle = sanitizeInlineStyle(element.getAttribute("style") || "");
    if (safeStyle) {
      element.setAttribute("style", safeStyle);
    } else {
      element.removeAttribute("style");
    }
  });
}

// Strict config for displaying user content
const STRICT_CONFIG: Config = {
  ALLOWED_TAGS: DEFAULT_ALLOWED_TAGS,
  ALLOWED_ATTR: DEFAULT_ALLOWED_ATTRS,
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["target"], // Allow target for links
  FORCE_BODY: true,
};

// Minimal config for plain text with basic formatting
const MINIMAL_CONFIG: Config = {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "br", "p"],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
};

// Link-safe config (allows links)
const LINK_SAFE_CONFIG: Config = {
  ALLOWED_TAGS: [...DEFAULT_ALLOWED_TAGS],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["target"],
};

/**
 * Sanitize HTML content for safe display
 * Prevents XSS attacks while preserving formatting
 *
 * @param html - Raw HTML string
 * @param config - Optional DOMPurify config override
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string, config?: Config): string {
  if (!html) return "";

  // Use provided config or default strict config
  const sanitized = DOMPurify.sanitize(html, config || STRICT_CONFIG);

  // Clean up nbsp entities for consistent spacing
  return sanitized.replace(/&nbsp;/g, " ");
}

/**
 * Sanitize HTML with minimal formatting (basic text only)
 * Good for comments, short text inputs
 */
export function sanitizeMinimal(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, MINIMAL_CONFIG).replace(/&nbsp;/g, " ");
}

/**
 * Strip all HTML tags and return plain text
 * Safe alternative to regex-based stripping
 *
 * @param html - Raw HTML string
 * @returns Plain text with no HTML
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  // Block boundaries and <br> become a space so "…end.</p><p>Start…" never
  // collapses into "end.Start" once the tags are gone.
  const spaced = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr|td|th)>/gi, " ");

  // Sanitize first to ensure safety, then extract text
  const sanitized = DOMPurify.sanitize(spaced, { ALLOWED_TAGS: [] });

  // Decode HTML entities; collapse runs of spaces (newlines are preserved for
  // stripHtmlPreserveLines, which pre-inserts them).
  return sanitized
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * Clean HTML for display - keeps tags but normalizes spacing
 * Use when you need to preserve HTML structure
 */
export function cleanHtmlForDisplay(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html).replace(/&nbsp;/g, " ");
}

/**
 * Get a text excerpt from HTML content
 * Safely strips HTML and truncates to specified length
 *
 * @param html - Raw HTML content
 * @param maxLength - Maximum character length
 * @returns Truncated plain text with ellipsis if needed
 */
export function getExcerpt(html: string, maxLength: number): string {
  const text = stripHtml(html);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

/**
 * Get excerpt by word count
 *
 * @param html - Raw HTML content
 * @param maxWords - Maximum number of words
 * @returns Object with text and truncation status
 */
export function getExcerptByWords(
  html: string,
  maxWords: number
): { text: string; isTruncated: boolean } {
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter((word) => word.length > 0);

  if (words.length <= maxWords) {
    return { text, isTruncated: false };
  }

  return {
    text: words.slice(0, maxWords).join(" ") + "...",
    isTruncated: true,
  };
}

/**
 * Count words in HTML content
 */
export function countWords(html: string): number {
  const text = stripHtml(html);
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Sanitize a URL to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string): string {
  if (!url) return "";

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return "";
  }

  return url;
}

/**
 * Create safe HTML for dangerouslySetInnerHTML
 * Returns object ready for React's dangerouslySetInnerHTML prop
 */
export function createSafeHtml(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) };
}

export default {
  sanitizeHtml,
  sanitizeMinimal,
  stripHtml,
  cleanHtmlForDisplay,
  getExcerpt,
  getExcerptByWords,
  countWords,
  sanitizeUrl,
  createSafeHtml,
};

/**
 * Strip HTML but keep the author's line structure — paragraph and heading
 * boundaries and <br> become newlines. Used for forms where line breaks carry
 * meaning (poems, letters) and for "first line" headlines.
 *
 * @param html - Raw HTML content
 * @returns Plain text with \n between lines, blank lines collapsed to one.
 */
export function stripHtmlPreserveLines(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<(p|div|h[1-6]|li|blockquote|pre|tr)[^>]*>/gi, "");
  const text = stripHtml(withBreaks);
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+$/g, "").replace(/^[ \t ]+/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
