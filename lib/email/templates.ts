/**
 * Order emails (Phase 2d): one layout, one copy table, both roles.
 *
 * Every order notification becomes an email through `renderOrderEmail`. The
 * copy table decides subject + heading per type (role-aware where it matters);
 * the notification's own `content` is the detail line; the order facts
 * (number, listing, the recipient's own money figure, due date) sit in a
 * small table; one button opens the order. Text part mirrors the HTML.
 */

export interface OrderEmailInput {
  type: string;
  role: "buyer" | "seller";
  recipientName: string;
  actorName: string;
  content: string | null;
  orderUrl: string;
  settingsUrl: string;
  order: {
    number: string | null;
    title: string | null;
    amount: number | null;
    currency: string | null;
    dueDate: string | null;
    listingType: string | null;
  };
}

interface Copy { subject: string; heading: string; cta?: string }
type CopyFn = (c: OrderEmailInput, f: { title: string; amount: string; due: string | null; actor: string }) => Copy;

const COPY: Record<string, CopyFn> = {
  order_pending_acceptance: (_, f) => ({ subject: `New request: ${f.title}`, heading: `${f.actor} sent you a request`, cta: "Accept or decline" }),
  order_accepted: (_, f) => ({ subject: `Request accepted — ${f.title}`, heading: `${f.actor} accepted your request`, cta: "Pay to start" }),
  order_declined: (_, f) => ({ subject: `Request declined — ${f.title}`, heading: `${f.actor} declined your request` }),
  order_placed: (_, f) => ({ subject: `New order: ${f.title}`, heading: `${f.actor} placed an order` }),
  order_paid: (_, f) => ({ subject: `Paid: ${f.title} · ${f.amount}`, heading: `${f.actor} paid — you can start`, cta: "Open the workroom" }),
  order_started: (_, f) => ({ subject: `Work started on ${f.title}`, heading: `${f.actor} started your order` }),
  order_delivered: (_, f) => ({ subject: `Delivery ready: ${f.title}`, heading: `${f.actor} delivered your order`, cta: "Review the delivery" }),
  order_completed: (_, f) => ({ subject: `Approved: ${f.title}`, heading: `${f.actor} approved the delivery` }),
  revision_requested: (_, f) => ({ subject: `Revision requested: ${f.title}`, heading: `${f.actor} asked for a revision`, cta: "See what changed" }),
  order_cancelled: (_, f) => ({ subject: `Cancelled: ${f.title}`, heading: "This order was cancelled" }),
  order_cancel_requested: (_, f) => ({ subject: `Cancellation requested: ${f.title}`, heading: `${f.actor} asked to cancel`, cta: "Answer the request" }),
  order_expired: (_, f) => ({ subject: `Checkout expired: ${f.title}`, heading: "Checkout expired before payment" }),
  order_payment_failed: (_, f) => ({ subject: `Payment didn't go through: ${f.title}`, heading: "Your payment didn't go through", cta: "Try again" }),
  review_received: (_, f) => ({ subject: `New review from ${f.actor}`, heading: `${f.actor} left you a review` }),
  order_message: (_, f) => ({ subject: `New message on ${f.title}`, heading: `${f.actor} sent a message`, cta: "Reply" }),
  order_disputed: (_, f) => ({ subject: `Dispute opened: ${f.title}`, heading: `${f.actor} opened a dispute`, cta: "Add your side" }),
  dispute_resolved: (_, f) => ({ subject: `Dispute resolved: ${f.title}`, heading: "The dispute was resolved" }),
  refund_requested: (_, f) => ({ subject: `Refund requested: ${f.title}`, heading: `${f.actor} asked for a refund`, cta: "Approve or decline" }),
  refund_declined: (_, f) => ({ subject: `Refund declined: ${f.title}`, heading: `${f.actor} declined the refund` }),
  refund_approved: (_, f) => ({ subject: `Refund approved: ${f.title}`, heading: "Your refund is on its way" }),
  order_refunded: (_, f) => ({ subject: `Refunded: ${f.title}`, heading: "This order was refunded" }),
  order_transfer_failed: (_, f) => ({ subject: `Payout needs attention: ${f.title}`, heading: "A payout attempt failed", cta: "Check payouts" }),
  chargeback_opened: (_, f) => ({ subject: `Chargeback opened: ${f.title}`, heading: "The buyer's bank opened a chargeback" }),
  chargeback_closed: (_, f) => ({ subject: `Chargeback closed: ${f.title}`, heading: "The chargeback was closed" }),
  order_due_soon: (_, f) => ({ subject: `Due tomorrow: ${f.title}`, heading: `Less than a day left${f.due ? ` · due ${f.due}` : ""}`, cta: "Deliver work" }),
  order_due: (c, f) => ({ subject: `Due today: ${f.title}`, heading: c.role === "seller" ? "This order is due" : "Your order was due today", cta: c.role === "seller" ? "Deliver or ask for time" : "Open order" }),
  order_late: (c, f) => ({ subject: `Running late: ${f.title}`, heading: c.role === "seller" ? "Two days past due" : "Your order is two days late", cta: c.role === "seller" ? "Deliver or ask for time" : "See your options" }),
  extension_requested: (_, f) => ({ subject: `More time requested: ${f.title}`, heading: `${f.actor} asked for more time`, cta: "Accept or decline" }),
  extension_accepted: (_, f) => ({ subject: `New due date agreed: ${f.title}`, heading: `${f.actor} agreed to the new date` }),
  extension_declined: (_, f) => ({ subject: `Extension declined: ${f.title}`, heading: `${f.actor} kept the original date` }),
};

export const ORDER_EMAIL_TYPES = new Set(Object.keys(COPY));

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function date(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface Rendered { subject: string; html: string; text: string }

export function renderOrderEmail(input: OrderEmailInput): Rendered | null {
  const copyFn = COPY[input.type];
  if (!copyFn) return null;
  const title = input.order.title || (input.order.listingType === "service" ? "your commission" : "your order");
  const amount = money(input.order.amount, input.order.currency);
  const due = date(input.order.dueDate);
  const copy = copyFn(input, { title, amount, due, actor: input.actorName });
  const cta = copy.cta ?? "Open order";

  const facts: Array<[string, string]> = [];
  if (input.order.number) facts.push(["Order", input.order.number]);
  if (input.order.title) facts.push([input.order.listingType === "service" ? "Commission" : "Listing", input.order.title]);
  if (amount) facts.push([input.role === "seller" ? "You receive" : "Total", amount]);
  if (due && input.order.listingType === "service") facts.push(["Due", due]);

  const factsHtml = facts.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0 0;border:1px solid #ece7f2;border-radius:12px;background:#faf8fc">${facts
        .map(([k, v]) => `<tr><td style="padding:9px 14px;font:600 11px/1.4 'Poppins',Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7a6f88;width:38%">${esc(k)}</td><td style="padding:9px 14px;font:500 14px/1.4 'Poppins',Helvetica,Arial,sans-serif;color:#1f1a26">${esc(v)}</td></tr>`)
        .join("")}</table>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f8f7fc">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f8f7fc"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px">
<tr><td style="padding:0 4px 14px;font:700 18px/1 'Poppins',Helvetica,Arial,sans-serif;color:#8e44ad">PinkQuill</td></tr>
<tr><td style="background:#ffffff;border:1px solid #ece7f2;border-radius:16px;padding:28px 28px 24px">
<p style="margin:0 0 6px;font:400 13px/1.5 'Open Sans',Helvetica,Arial,sans-serif;color:#7a6f88">Hi ${esc(input.recipientName)},</p>
<h1 style="margin:0 0 10px;font:600 20px/1.3 'Poppins',Helvetica,Arial,sans-serif;color:#1f1a26">${esc(copy.heading)}</h1>
${input.content ? `<p style="margin:0;font:400 15px/1.55 'Open Sans',Helvetica,Arial,sans-serif;color:#3d3547">${esc(input.content)}</p>` : ""}
${factsHtml}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0"><tr><td style="border-radius:999px;background:#8e44ad"><a href="${esc(input.orderUrl)}" style="display:inline-block;padding:12px 22px;font:600 14px/1 'Poppins',Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px">${esc(cta)}</a></td></tr></table>
</td></tr>
<tr><td style="padding:16px 8px 0;font:400 12px/1.5 'Open Sans',Helvetica,Arial,sans-serif;color:#9a90a8">You get this because you have an order on PinkQuill. <a href="${esc(input.settingsUrl)}" style="color:#8e44ad">Email settings</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hi ${input.recipientName},`,
    "",
    copy.heading,
    input.content ? `\n${input.content}` : "",
    facts.length ? `\n${facts.map(([k, v]) => `${k}: ${v}`).join("\n")}` : "",
    "",
    `${cta}: ${input.orderUrl}`,
    "",
    `Email settings: ${input.settingsUrl}`,
  ].filter((line) => line !== "").join("\n");

  return { subject: copy.subject, html, text };
}
