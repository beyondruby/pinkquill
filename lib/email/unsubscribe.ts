/**
 * Signed one-click unsubscribe links (server only).
 *
 * Every notification email carries a link that turns one category off
 * without signing in, plus the RFC 8058 `List-Unsubscribe` headers so mail
 * clients can show their own "Unsubscribe" button. The link is
 *   /api/email/unsubscribe?u=<user id>&c=<category|all>&t=<hmac>
 * signed with EMAIL_UNSUBSCRIBE_SECRET (falls back to CRON_SECRET so nothing
 * new has to be configured). A token only ever mutes; it cannot read data.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || null;
}

export function signUnsubscribe(userId: string, category: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`${userId}.${category}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string, category: string, token: string): boolean {
  const expected = signUnsubscribe(userId, category);
  if (!expected || !token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function unsubscribeUrl(baseUrl: string, userId: string, category: string): string | null {
  const token = signUnsubscribe(userId, category);
  if (!token) return null;
  const params = new URLSearchParams({ u: userId, c: category, t: token });
  return `${baseUrl}/api/email/unsubscribe?${params.toString()}`;
}
