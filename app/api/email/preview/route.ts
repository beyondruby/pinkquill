/**
 * Email preview for design checks. Renders any template with sample data.
 *   /api/email/preview                → index of every template
 *   /api/email/preview?type=comment   → one notification email
 *   /api/email/preview?type=dm_digest → the message digest
 *   /api/email/preview?type=auth:confirmation → a Supabase auth template
 *   …&format=text                     → the plain-text part
 * Platform admins only in production; open in development.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { buildAuthTemplates } from "@/lib/email/auth-templates";
import { esc } from "@/lib/email/layout";
import { EMAIL_TYPES, renderDmDigestEmail, renderNotificationEmail, type NotificationEmailInput } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://www.pinkquill.com";
const URLS = { base: BASE, settings: `${BASE}/settings/notifications`, unsubscribe: `${BASE}/api/email/unsubscribe?u=preview&c=orders&t=preview` };

function sample(type: string, role: "buyer" | "seller"): NotificationEmailInput {
  const isOrder = type.startsWith("order_") || ["revision_requested", "review_received", "dispute_resolved", "refund_requested", "refund_declined", "refund_approved", "chargeback_opened", "chargeback_closed", "extension_requested", "extension_accepted", "extension_declined"].includes(type);
  return {
    type,
    recipient: { name: "Hadi", email: "hadi@example.com" },
    actor: { name: "Poet Laurent", username: "poet", avatarUrl: null },
    content: type === "comment" || type === "reply" ? "This stanza stopped me in my tracks. The turn in the third line is perfect." : type === "community_warning" ? "Please keep critiques constructive; see rule 3." : type === "community_role_change" ? "You are now a moderator." : isOrder ? "Delivered the final files with a short note on the revisions." : null,
    post: { id: "00000000-0000-0000-0000-000000000001", title: "Morning, Unwritten", type: "poem", excerpt: "There is a hush before the kettle sings, a page that waits for ink it never asked for…" },
    comment: { id: "00000000-0000-0000-0000-000000000002", content: "Your line breaks do a lot of quiet work here." },
    community: { name: "Night Writers", slug: "night-writers" },
    order: isOrder
      ? { id: "00000000-0000-0000-0000-000000000003", role, number: "PQ-20260904-0042", title: "Custom editing & sensitivity read", amount: role === "seller" ? 47.5 : 51.98, currency: "usd", dueDate: new Date(Date.now() + 5 * 864e5).toISOString(), listingType: "service" }
      : null,
    urls: URLS,
  };
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const gate = await requireAdmin(request);
    if ("error" in gate) return gate.error;
  }
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const role = url.searchParams.get("role") === "seller" ? "seller" : "buyer";
  const format = url.searchParams.get("format") === "text" ? "text" : "html";

  if (!type) {
    const items = [...EMAIL_TYPES].map((t) => `<li><a href="?type=${t}">${t}</a> <a href="?type=${t}&role=seller">(seller)</a> <a href="?type=${t}&format=text">(text)</a></li>`);
    items.push(`<li><a href="?type=dm_digest">dm_digest</a></li>`);
    for (const a of buildAuthTemplates()) items.push(`<li><a href="?type=auth:${a.key}">auth:${a.key}</a> — ${esc(a.subject)}</li>`);
    return new NextResponse(`<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:system-ui;padding:24px;line-height:1.8"><h1>Email previews</h1><ul>${items.join("")}</ul>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  let rendered: { subject: string; html: string; text: string } | null = null;
  if (type === "dm_digest") {
    rendered = renderDmDigestEmail({
      recipient: { name: "Hadi", email: "hadi@example.com" },
      sender: { name: "Poet Laurent", username: "poet", avatarUrl: null },
      messages: [
        { content: "Hey! Loved the new piece.", type: "text" },
        { content: "Would you be up for a collab next month? I have an idea for a shared zine.", type: "text" },
      ],
      conversationUrl: `${BASE}/messages?conversation=00000000-0000-0000-0000-000000000004`,
      urls: { settings: URLS.settings, unsubscribe: URLS.unsubscribe },
    });
  } else if (type.startsWith("auth:")) {
    const t = buildAuthTemplates().find((a) => a.key === type.slice(5));
    rendered = t ? { subject: t.subject, html: t.rendered.html.replace(/\{\{ \.Token \}\}/g, "482 913").replace(/\{\{ \.ConfirmationURL \}\}/g, `${BASE}/auth/callback`).replace(/\{\{ \.Email \}\}/g, "hadi@example.com").replace(/\{\{ \.NewEmail \}\}/g, "hadi@new.example.com"), text: t.rendered.text } : null;
  } else if (EMAIL_TYPES.has(type)) {
    rendered = renderNotificationEmail(sample(type, role));
  }
  if (!rendered) return NextResponse.json({ error: "unknown type" }, { status: 404 });

  if (format === "text") return new NextResponse(`Subject: ${rendered.subject}\n\n${rendered.text}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new NextResponse(rendered.html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Email-Subject": encodeURIComponent(rendered.subject) } });
}
