/**
 * Sanitizes free-form user input before embedding it in PostgREST filter strings.
 * This avoids malformed filters and query-structure injection via reserved chars.
 */
export function sanitizePostgrestSearchTerm(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s@._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a safe PostgREST `in.(...)` filter for UUID-like identifiers.
 * Empty or fully-invalid lists return null so callers can skip subscribing.
 */
export function buildPostgrestInFilter(column: string, values: string[]): string | null {
  const sanitizedValues = values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => value.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean);

  if (!column || sanitizedValues.length === 0) {
    return null;
  }

  return `${column}=in.(${sanitizedValues.join(",")})`;
}
