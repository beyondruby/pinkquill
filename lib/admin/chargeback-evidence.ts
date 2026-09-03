/**
 * Chargeback evidence (Phase 2f). Pure helpers that turn what Pinkquill knows
 * about an order into the fields Stripe's dispute API accepts. The route
 * uploads files and calls Stripe; this file only shapes text so it can be
 * previewed, edited and unit-tested.
 */

export const EVIDENCE_FILE_FIELDS = [
  "uncategorized_file",
  "customer_communication",
  "service_documentation",
  "receipt",
  "refund_policy",
  "cancellation_policy",
  "customer_signature",
  "shipping_documentation",
] as const;
export type EvidenceFileField = (typeof EVIDENCE_FILE_FIELDS)[number];

export const EVIDENCE_TEXT_FIELDS = [
  "product_description",
  "customer_communication",
  "uncategorized_text",
  "service_date",
  "customer_name",
  "customer_email_address",
  "access_activity_log",
  "refund_policy_disclosure",
  "cancellation_policy_disclosure",
] as const;
export type EvidenceTextField = (typeof EVIDENCE_TEXT_FIELDS)[number];

export type EvidenceText = Partial<Record<EvidenceTextField, string>>;

export interface EvidencePack {
  order: {
    order_number: string;
    listing_type: string;
    status: string;
    amount: number;
    currency: string;
    total_amount: number | null;
    created_at: string;
    started_at: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    due_date: string | null;
    brief: string | null;
    requirements: unknown;
  };
  product: { title: string | null; description: string | null } | null;
  pricing: { variant_name: string | null; delivery_days: number | null; revisions: number | null; package_features: string[] | null } | null;
  buyer: { username: string | null; display_name: string | null; email: string | null };
  seller: { username: string | null; display_name: string | null };
  messages: Array<{ role: "buyer" | "seller" | "system"; at: string; text: string }>;
  deliveries: Array<{ version: number; at: string; files: number; status: string | null }>;
  evidenceItems: Array<{ role: string; at: string; text: string; attachments: Array<{ path: string; name: string; size?: number; type?: string }> }>;
}

const MAX_FIELD = 15_000;

function clip(s: string, max = MAX_FIELD): string {
  return s.length > max ? `${s.slice(0, max - 20).trimEnd()}\n… (truncated)` : s;
}

function when(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function money(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "";
  return `${Number(amount).toFixed(2)} ${currency.toUpperCase()}`;
}

/** Stripe's text fields, pre-filled from the order. Every field can be edited before sending. */
export function draftEvidenceText(pack: EvidencePack): EvidenceText {
  const { order, product, pricing, buyer, seller } = pack;
  const isService = order.listing_type === "service";

  const productDescription = [
    `${isService ? "Commission" : "Digital product"} ordered on Pinkquill (order ${order.order_number}).`,
    product?.title ? `Listing: ${product.title}.` : null,
    pricing?.variant_name ? `Package: ${pricing.variant_name}${pricing.delivery_days ? ` · ${pricing.delivery_days}-day delivery` : ""}${pricing.revisions != null ? ` · ${pricing.revisions} revision${pricing.revisions === 1 ? "" : "s"}` : ""}.` : null,
    pricing?.package_features?.length ? `Includes: ${pricing.package_features.join("; ")}.` : null,
    product?.description ? `Listing description: ${product.description}` : null,
    order.brief ? `Buyer's brief: ${order.brief}` : null,
    `Price ${money(order.amount, order.currency)}${order.total_amount != null && order.total_amount !== order.amount ? `, total charged ${money(order.total_amount, order.currency)} including the processing fee` : ""}.`,
    `Creator: ${seller.display_name || seller.username || "the seller"} (@${seller.username ?? ""}).`,
  ].filter(Boolean).join("\n");

  const timeline = [
    `Ordered ${when(order.created_at)}`,
    order.started_at ? `Work started ${when(order.started_at)}` : null,
    ...pack.deliveries.map((d) => `Delivery v${d.version} submitted ${when(d.at)} (${d.files} file${d.files === 1 ? "" : "s"}${d.status ? `, ${d.status}` : ""})`),
    order.completed_at ? `Delivery approved by the buyer ${when(order.completed_at)}` : null,
    order.due_date ? `Agreed due date ${when(order.due_date)}` : null,
  ].filter(Boolean).join("\n");

  const transcript = pack.messages
    .filter((m) => m.role !== "system")
    .map((m) => `[${when(m.at)}] ${m.role === "buyer" ? (buyer.display_name || buyer.username || "Buyer") : (seller.display_name || seller.username || "Creator")}: ${m.text}`)
    .join("\n");

  const sellerStatements = pack.evidenceItems
    .filter((e) => e.text.trim())
    .map((e) => `[${when(e.at)}] ${e.role}: ${e.text.trim()}`)
    .join("\n\n");

  const narrative = [
    `The buyer placed this order on Pinkquill and paid by card${order.total_amount != null ? ` (${money(order.total_amount, order.currency)})` : ""}.`,
    isService
      ? "The creator delivered the commissioned work through the platform's order workroom; delivery files and versions are recorded with timestamps."
      : "The digital files were delivered through the platform at payment and were available for download from the order page.",
    order.completed_at ? "The buyer approved the delivery on the platform." : order.status === "completed" ? "The order was auto-approved after the review window passed without objection." : null,
    sellerStatements ? `Statements from the participants:\n${sellerStatements}` : null,
  ].filter(Boolean).join("\n\n");

  const serviceDate = order.submitted_at ?? order.completed_at ?? order.started_at ?? order.created_at;

  return {
    product_description: clip(productDescription),
    customer_communication: clip(transcript || "No messages were exchanged on the order thread."),
    access_activity_log: clip(timeline),
    uncategorized_text: clip(narrative),
    service_date: serviceDate ? new Date(serviceDate).toISOString().slice(0, 10) : "",
    customer_name: buyer.display_name || buyer.username || "",
    customer_email_address: buyer.email || "",
    refund_policy_disclosure: "Refund and cancellation terms are shown on every listing and at checkout: a full refund before work starts, the creator decides on requests after that, and a full refund is available if delivery runs more than three days late.",
    cancellation_policy_disclosure: "Buyers can cancel for a full refund until the creator starts work; after that, cancellation is a request the creator answers, or a dispute the platform resolves.",
  };
}

/** Keep only Stripe-known keys with non-empty values, clipped to size. */
export function normalizeEvidenceText(input: Record<string, unknown> | null | undefined): EvidenceText {
  const out: EvidenceText = {};
  if (!input) return out;
  for (const key of EVIDENCE_TEXT_FIELDS) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) out[key] = clip(v.trim());
  }
  return out;
}

export function isEvidenceFileField(v: unknown): v is EvidenceFileField {
  return typeof v === "string" && (EVIDENCE_FILE_FIELDS as readonly string[]).includes(v);
}
