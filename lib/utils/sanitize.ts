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

// Default allowed attributes
const DEFAULT_ALLOWED_ATTRS = ["href", "target", "rel", "class"];

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
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
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

  // Sanitize first to ensure safety, then extract text
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });

  // Decode HTML entities
  return sanitized
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
