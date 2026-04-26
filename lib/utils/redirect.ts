/**
 * Validate a redirect path to prevent open-redirect attacks.
 * Only allows relative paths starting with `/`. Rejects protocol-relative
 * URLs (`//evil.com`), absolute URLs, and `javascript:` URIs.
 */
export function getSafeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/";

  const trimmed = next.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.toLowerCase().includes("://") ||
    trimmed.toLowerCase().startsWith("javascript:")
  ) {
    return "/";
  }

  return trimmed;
}
