/**
 * Outbound email (Phase 2d). One function, one provider behind it.
 *
 * D7 assumption: Resend over its HTTP API — no SDK, no SMTP, nothing to
 * install. Until RESEND_API_KEY is set the function is inert: it logs the
 * subject and reports `skipped`, so every environment can run without
 * sending mail. Swap providers by replacing `deliver()` only.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { ok: true; id: string | null; skipped?: undefined }
  | { ok: true; id: null; skipped: "no_provider" }
  | { ok: false; error: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Pinkquill <no-reply@pinkquill.com>";
}

async function deliver(message: EmailMessage, apiKey: string): Promise<SendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress(), to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });
  let body: { id?: string; message?: string; name?: string } = {};
  try { body = await response.json(); } catch { /* empty or non-JSON body */ }
  if (!response.ok) return { ok: false, error: body.message || body.name || `Email provider returned ${response.status}` };
  return { ok: true, id: body.id ?? null };
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") console.info(`[email] not configured — would send "${message.subject}" to ${message.to}`);
    return { ok: true, id: null, skipped: "no_provider" };
  }
  try {
    return await deliver(message, apiKey);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}
