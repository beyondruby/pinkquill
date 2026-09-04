/**
 * The one PinkQuill email layout (Sep 2026).
 *
 * Every email the platform sends — order updates, comments, follows,
 * community notices, message digests, and the Supabase auth mails — is
 * rendered through `renderEmail`. The look is deliberately close to the big
 * social networks' transactional mail: a wordmark, one white card with the
 * person who acted next to a one-line headline, an optional quoted excerpt,
 * a few facts, one button, and a quiet footer that says why you got it and
 * how to stop it.
 *
 * Table layout + inline styles only (Gmail, Outlook, Apple Mail). No CSS
 * gradients on anything that must render everywhere; the brand gradient is
 * limited to the small logo tile where a solid fallback is acceptable.
 */

export interface EmailFacts {
  rows: Array<[label: string, value: string]>;
}

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailActor {
  name: string;
  avatarUrl?: string | null;
}

export interface EmailCode {
  /** A one-time code, shown large and letter-spaced. Not escaped — pass trusted text or a template placeholder. */
  value: string;
  caption?: string;
}

export interface RenderEmailInput {
  subject: string;
  /** Hidden inbox preview line. Defaults to the headline text. */
  preheader?: string;
  /** Headline HTML. Use `strong()` for the actor name. Already-escaped HTML. */
  headingHtml: string;
  /** Plain-text version of the headline. */
  headingText: string;
  /** Person shown beside the headline (avatar or initial). */
  actor?: EmailActor | null;
  /** Greeting line, e.g. "Hi Hadi,". Omitted when null. */
  greeting?: string | null;
  /** Body paragraphs, plain text (escaped here). */
  paragraphs?: string[];
  /** A quoted excerpt (comment, message, brief). Escaped here. */
  quote?: string | null;
  facts?: EmailFacts | null;
  code?: EmailCode | null;
  button?: EmailButton | null;
  /** Small text link under the button. */
  secondaryLink?: EmailButton | null;
  /** Why the person got this, e.g. "You're getting this because someone commented on your post." */
  reason: string;
  /** "Manage email settings" link. */
  settingsUrl?: string | null;
  /** One-click unsubscribe for this category. */
  unsubscribe?: { label: string; url: string } | null;
  /** Address the mail went to, for the footer line. */
  recipientEmail?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const BRAND = {
  name: "PinkQuill",
  siteUrl: "https://www.pinkquill.com",
  ground: "#f5f3f9",
  card: "#ffffff",
  line: "#ebe6f2",
  ink: "#1e1a24",
  body: "#4a4454",
  muted: "#8a8296",
  accent: "#8e44ad",
  accentDark: "#6f3389",
  soft: "#faf8fc",
  gradient: "linear-gradient(135deg, #8e44ad 0%, #ff007f 60%, #ff9f43 100%)",
};

const FONT = "'Poppins','Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_BODY = "'Open Sans','Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Bold actor name for headlines: `${strong(name)} commented on your poem`. Escapes. */
export function strong(s: string): string {
  return `<strong style="color:${BRAND.ink};font-weight:600">${esc(s)}</strong>`;
}

function initial(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}

function avatarCell(actor: EmailActor): string {
  if (actor.avatarUrl) {
    return `<img src="${esc(actor.avatarUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:24px;object-fit:cover;border:0">`;
  }
  return `<div style="width:48px;height:48px;border-radius:24px;background:${BRAND.accent};background-image:${BRAND.gradient};color:#ffffff;font:600 20px/48px ${FONT};text-align:center">${esc(initial(actor.name))}</div>`;
}

function logoRow(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="width:34px;height:34px;border-radius:9px;background:${BRAND.accent};background-image:${BRAND.gradient};text-align:center;vertical-align:middle;color:#ffffff;font:400 18px/34px ${FONT}">&#10002;</td>
<td style="padding-left:10px;font:700 19px/1 ${FONT};color:${BRAND.ink};letter-spacing:-0.01em">PinkQuill</td>
</tr></table>`;
}

export function renderEmail(input: RenderEmailInput): RenderedEmail {
  const paragraphs = input.paragraphs ?? [];
  const preheader = input.preheader ?? input.headingText;

  const headingBlock = input.actor
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
<td style="width:48px;vertical-align:top;padding-right:14px">${avatarCell(input.actor)}</td>
<td style="vertical-align:middle;font:400 19px/1.35 ${FONT};color:${BRAND.ink}">${input.headingHtml}</td>
</tr></table>`
    : `<h1 style="margin:0;font:600 22px/1.3 ${FONT};color:${BRAND.ink};letter-spacing:-0.01em">${input.headingHtml}</h1>`;

  const greeting = input.greeting
    ? `<p style="margin:0 0 8px;font:400 14px/1.5 ${FONT_BODY};color:${BRAND.muted}">${esc(input.greeting)}</p>`
    : "";

  const paragraphsHtml = paragraphs
    .map((p) => `<p style="margin:14px 0 0;font:400 15px/1.6 ${FONT_BODY};color:${BRAND.body}">${esc(p)}</p>`)
    .join("");

  const quoteHtml = input.quote
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:18px"><tr><td style="background:${BRAND.soft};border:1px solid ${BRAND.line};border-radius:14px;padding:14px 16px;font:400 15px/1.55 ${FONT_BODY};color:${BRAND.ink}">${esc(input.quote).replace(/\n/g, "<br>")}</td></tr></table>`
    : "";

  const factsHtml = input.facts && input.facts.rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:18px;border:1px solid ${BRAND.line};border-radius:14px;background:${BRAND.soft}">${input.facts.rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:${i === 0 ? 12 : 8}px 16px ${i === input.facts!.rows.length - 1 ? 12 : 4}px;font:400 13px/1.4 ${FONT_BODY};color:${BRAND.muted};width:36%">${esc(k)}</td><td style="padding:${i === 0 ? 12 : 8}px 16px ${i === input.facts!.rows.length - 1 ? 12 : 4}px;font:500 14px/1.4 ${FONT};color:${BRAND.ink}">${esc(v)}</td></tr>`
        )
        .join("")}</table>`
    : "";

  const codeHtml = input.code
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:20px"><tr><td align="center" style="background:${BRAND.soft};border:1px solid ${BRAND.line};border-radius:14px;padding:22px 16px">
<div style="font:600 34px/1 ${FONT};letter-spacing:0.28em;color:${BRAND.ink};padding-left:0.28em">${input.code.value}</div>
${input.code.caption ? `<div style="margin-top:10px;font:400 13px/1.4 ${FONT_BODY};color:${BRAND.muted}">${esc(input.code.caption)}</div>` : ""}
</td></tr></table>`
    : "";

  const buttonHtml = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td style="border-radius:999px;background:${BRAND.accent}"><a href="${esc(input.button.url)}" style="display:inline-block;padding:13px 26px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px">${esc(input.button.label)}</a></td></tr></table>`
    : "";

  const secondaryHtml = input.secondaryLink
    ? `<p style="margin:14px 0 0;font:400 13px/1.5 ${FONT_BODY};color:${BRAND.muted}"><a href="${esc(input.secondaryLink.url)}" style="color:${BRAND.accent};text-decoration:underline">${esc(input.secondaryLink.label)}</a></p>`
    : "";

  const footerLinks: string[] = [];
  if (input.settingsUrl) footerLinks.push(`<a href="${esc(input.settingsUrl)}" style="color:${BRAND.muted};text-decoration:underline">Email settings</a>`);
  if (input.unsubscribe) footerLinks.push(`<a href="${esc(input.unsubscribe.url)}" style="color:${BRAND.muted};text-decoration:underline">${esc(input.unsubscribe.label)}</a>`);

  const sentTo = input.recipientEmail ? ` This email was sent to ${esc(input.recipientEmail)}.` : "";

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(input.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${BRAND.ground};-webkit-text-size-adjust:100%}
  a{color:${BRAND.accent}}
  @media (max-width:600px){.pq-card{padding:24px 20px !important}.pq-wrap{padding:20px 12px 32px !important}}
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.ground}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(preheader)}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${BRAND.ground}"><tr><td align="center" class="pq-wrap" style="padding:32px 16px 40px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
<tr><td style="padding:0 6px 18px">${logoRow()}</td></tr>
<tr><td class="pq-card" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:20px;padding:30px 32px 30px">
${greeting}${headingBlock}${paragraphsHtml}${quoteHtml}${factsHtml}${codeHtml}${buttonHtml}${secondaryHtml}
</td></tr>
<tr><td style="padding:20px 10px 0;font:400 12.5px/1.6 ${FONT_BODY};color:${BRAND.muted}">
${esc(input.reason)}${sentTo}${footerLinks.length ? `<br>${footerLinks.join(" &nbsp;·&nbsp; ")}` : ""}
<br><a href="${BRAND.siteUrl}" style="color:${BRAND.muted};text-decoration:none">PinkQuill · www.pinkquill.com</a>
</td></tr>
</table></td></tr></table>
</body></html>`;

  const textLines: string[] = [];
  if (input.greeting) textLines.push(input.greeting, "");
  textLines.push(input.headingText);
  for (const p of paragraphs) textLines.push("", p);
  if (input.quote) textLines.push("", `> ${input.quote.replace(/\n/g, "\n> ")}`);
  if (input.facts?.rows.length) textLines.push("", ...input.facts.rows.map(([k, v]) => `${k}: ${v}`));
  if (input.code) textLines.push("", input.code.value, ...(input.code.caption ? [input.code.caption] : []));
  if (input.button) textLines.push("", `${input.button.label}: ${input.button.url}`);
  if (input.secondaryLink) textLines.push(`${input.secondaryLink.label}: ${input.secondaryLink.url}`);
  textLines.push("", input.reason + (input.recipientEmail ? ` This email was sent to ${input.recipientEmail}.` : ""));
  if (input.settingsUrl) textLines.push(`Email settings: ${input.settingsUrl}`);
  if (input.unsubscribe) textLines.push(`${input.unsubscribe.label}: ${input.unsubscribe.url}`);
  textLines.push("", "PinkQuill · https://www.pinkquill.com");

  return { subject: input.subject, html, text: textLines.join("\n") };
}
