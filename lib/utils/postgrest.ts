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
