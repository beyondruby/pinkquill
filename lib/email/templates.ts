/**
 * Notification emails (site-wide, Sep 2026): one copy table for every
 * notification type that can leave the app, plus the direct-message digest.
 *
 * `renderNotificationEmail` turns a notification row (with the actor, post,
 * comment, community or order it points at) into subject + HTML + text
 * through the shared layout in `./layout`. The copy table decides subject,
 * headline, button and "why you got this" per type, role-aware for orders.
 */
import { BRAND, esc, renderEmail, strong, type EmailFacts, type RenderedEmail } from "./layout";
import { emailCategoryForType, getEmailCategory } from "./preferences";

export interface NotificationEmailInput {
  type: string;
  recipient: { name: string; email: string | null };
  actor: { name: string; username: string | null; avatarUrl: string | null } | null;
  /** The notification's own `content` (comment text, reason, system line). */
  content: string | null;
  post: { id: string; title: string | null; type: string | null; excerpt: string | null } | null;
  comment: { id: string; content: string | null } | null;
  community: { name: string; slug: string } | null;
  order: {
    id: string;
    role: "buyer" | "seller";
    number: string | null;
    title: string | null;
    amount: number | null;
    currency: string | null;
    dueDate: string | null;
    listingType: string | null;
  } | null;
  urls: { base: string; settings: string; unsubscribe: string };
}

interface Copy {
  subject: string;
  headingHtml: string;
  headingText: string;
  paragraphs?: string[];
  quote?: string | null;
  button: { label: string; url: string };
  reason: string;
  /** Show the actor's avatar beside the headline (default true when an actor exists). */
  showActor?: boolean;
}

interface Ctx {
  actor: string;
  actorHtml: string;
  post: string;
  postHtml: string;
  postUrl: string;
  commentUrl: string;
  communityName: string;
  communityUrl: string;
  profileUrl: string;
  orderUrl: string;
  orderTitle: string;
  amount: string;
  due: string | null;
  base: string;
}

type CopyFn = (input: NotificationEmailInput, c: Ctx) => Copy;

const POST_REASON = "You're getting this because someone interacted with your work on PinkQuill.";
const ORDER_REASON = "You're getting this because you have an order on PinkQuill.";
const COMMUNITY_REASON = "You're getting this because of a community you belong to on PinkQuill.";

function truncate(s: string | null | undefined, max = 280): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

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

/** "your poem “Morning”" / "your post" — mirrors the notification panel's phrasing. */
function postPhrase(post: NotificationEmailInput["post"]): { text: string; html: string } {
  const kind = post?.type || "post";
  const title = truncate(post?.title, 60);
  return title
    ? { text: `your ${kind} “${title}”`, html: `your ${esc(kind)} <span style="color:${BRAND.ink}">“${esc(title)}”</span>` }
    : { text: `your ${kind}`, html: `your ${esc(kind)}` };
}

const reaction = (verb: string): CopyFn => (input, c) => ({
  subject: `${c.actor} ${verb} ${c.post}`,
  headingHtml: `${c.actorHtml} ${verb} ${c.postHtml}`,
  headingText: `${c.actor} ${verb} ${c.post}`,
  quote: truncate(input.post?.excerpt, 200),
  button: { label: "See your post", url: c.postUrl },
  reason: POST_REASON,
});

const COPY: Record<string, CopyFn> = {
  // ---- post activity -------------------------------------------------------
  admire: reaction("admired"),
  snap: reaction("snapped for"),
  ovation: reaction("gave a standing ovation to"),
  support: reaction("showed support for"),
  inspired: reaction("was inspired by"),
  applaud: reaction("applauded"),
  relay: reaction("relayed"),
  save: reaction("saved"),

  // ---- comments & mentions -------------------------------------------------
  comment: (input, c) => ({
    subject: `${c.actor} commented on ${c.post}`,
    headingHtml: `${c.actorHtml} commented on ${c.postHtml}`,
    headingText: `${c.actor} commented on ${c.post}`,
    quote: truncate(input.content ?? input.comment?.content),
    button: { label: "Reply", url: c.commentUrl },
    reason: POST_REASON,
  }),
  reply: (input, c) => ({
    subject: `${c.actor} replied to your comment`,
    headingHtml: `${c.actorHtml} replied to your comment`,
    headingText: `${c.actor} replied to your comment`,
    quote: truncate(input.content ?? input.comment?.content),
    button: { label: "See the reply", url: c.commentUrl },
    reason: POST_REASON,
  }),
  comment_like: (input, c) => ({
    subject: `${c.actor} liked your comment`,
    headingHtml: `${c.actorHtml} liked your comment`,
    headingText: `${c.actor} liked your comment`,
    quote: truncate(input.comment?.content ?? input.content),
    button: { label: "Open the thread", url: c.commentUrl },
    reason: POST_REASON,
  }),
  mention: (input, c) => ({
    subject: `${c.actor} mentioned you`,
    headingHtml: `${c.actorHtml} mentioned you in their ${esc(input.post?.type || "post")}`,
    headingText: `${c.actor} mentioned you in their ${input.post?.type || "post"}`,
    quote: truncate(input.post?.title ?? input.post?.excerpt ?? input.content, 200),
    button: { label: "See the mention", url: c.postUrl },
    reason: "You're getting this because someone mentioned you on PinkQuill.",
  }),

  // ---- follows -------------------------------------------------------------
  follow: (_input, c) => ({
    subject: `${c.actor} started following you`,
    headingHtml: `${c.actorHtml} started following you`,
    headingText: `${c.actor} started following you`,
    button: { label: "See their studio", url: c.profileUrl },
    reason: "You're getting this because someone followed you on PinkQuill.",
  }),
  follow_request: (_input, c) => ({
    subject: `${c.actor} wants to follow you`,
    headingHtml: `${c.actorHtml} requested to follow you`,
    headingText: `${c.actor} requested to follow you`,
    button: { label: "See who asked", url: c.profileUrl },
    reason: "You're getting this because someone asked to follow your private studio on PinkQuill.",
  }),
  follow_request_accepted: (_input, c) => ({
    subject: `${c.actor} accepted your follow request`,
    headingHtml: `${c.actorHtml} accepted your follow request`,
    headingText: `${c.actor} accepted your follow request`,
    button: { label: "Visit their studio", url: c.profileUrl },
    reason: "You're getting this because a follow request you sent on PinkQuill was answered.",
  }),

  // ---- communities ---------------------------------------------------------
  community_invite: (_input, c) => ({
    subject: `${c.actor} invited you to ${c.communityName}`,
    headingHtml: `${c.actorHtml} invited you to join ${strong(c.communityName)}`,
    headingText: `${c.actor} invited you to join ${c.communityName}`,
    button: { label: "See the invite", url: c.communityUrl },
    reason: "You're getting this because someone invited you to a community on PinkQuill.",
  }),
  community_join_request: (_input, c) => ({
    subject: `${c.actor} wants to join ${c.communityName}`,
    headingHtml: `${c.actorHtml} requested to join ${strong(c.communityName)}`,
    headingText: `${c.actor} requested to join ${c.communityName}`,
    button: { label: "Review the request", url: `${c.communityUrl}/settings/members` },
    reason: "You're getting this because you moderate a community on PinkQuill.",
  }),
  community_join_approved: (_input, c) => ({
    subject: `You're in: ${c.communityName}`,
    headingHtml: `Your request to join ${strong(c.communityName)} was approved`,
    headingText: `Your request to join ${c.communityName} was approved`,
    button: { label: "Open the community", url: c.communityUrl },
    reason: COMMUNITY_REASON,
    showActor: false,
  }),
  community_role_change: (input, c) => ({
    subject: `Your role in ${c.communityName} changed`,
    headingHtml: `Your role in ${strong(c.communityName)} changed`,
    headingText: `Your role in ${c.communityName} changed`,
    paragraphs: input.content ? [input.content] : [],
    button: { label: "Open the community", url: c.communityUrl },
    reason: COMMUNITY_REASON,
    showActor: false,
  }),
  community_muted: (input, c) => ({
    subject: `You were muted in ${c.communityName}`,
    headingHtml: `You were muted in ${strong(c.communityName)}`,
    headingText: `You were muted in ${c.communityName}`,
    paragraphs: input.content ? [input.content] : [],
    button: { label: "Read the notice", url: `${c.base}/messages/community?community=${encodeURIComponent(input.community?.slug ?? "")}` },
    reason: COMMUNITY_REASON,
    showActor: false,
  }),
  community_banned: (input, c) => ({
    subject: `You were removed from ${c.communityName}`,
    headingHtml: `You were banned from ${strong(c.communityName)}`,
    headingText: `You were banned from ${c.communityName}`,
    paragraphs: input.content ? [input.content] : [],
    button: { label: "Read the notice", url: `${c.base}/messages/community?community=${encodeURIComponent(input.community?.slug ?? "")}` },
    reason: COMMUNITY_REASON,
    showActor: false,
  }),
  community_warning: (input, c) => ({
    subject: `A warning from ${c.communityName}`,
    headingHtml: `A moderator sent you a warning in ${strong(c.communityName)}`,
    headingText: `A moderator sent you a warning in ${c.communityName}`,
    quote: truncate(input.content),
    button: { label: "Read the warning", url: `${c.base}/messages/community?community=${encodeURIComponent(input.community?.slug ?? "")}` },
    reason: COMMUNITY_REASON,
    showActor: false,
  }),

  // ---- collaborations ------------------------------------------------------
  collaboration_invite: (input, c) => ({
    subject: `${c.actor} invited you to collaborate`,
    headingHtml: `${c.actorHtml} invited you to collaborate on their ${esc(input.post?.type || "post")}`,
    headingText: `${c.actor} invited you to collaborate on their ${input.post?.type || "post"}`,
    quote: truncate(input.post?.title ?? input.post?.excerpt, 160),
    button: { label: "See the invite", url: c.postUrl },
    reason: "You're getting this because someone invited you to collaborate on PinkQuill.",
  }),
  collaboration_accepted: (_input, c) => ({
    subject: `${c.actor} accepted your collaboration invite`,
    headingHtml: `${c.actorHtml} accepted your collaboration invite`,
    headingText: `${c.actor} accepted your collaboration invite`,
    button: { label: "Open the post", url: c.postUrl },
    reason: "You're getting this because of a collaboration you started on PinkQuill.",
  }),
  collaboration_declined: (_input, c) => ({
    subject: `${c.actor} declined your collaboration invite`,
    headingHtml: `${c.actorHtml} declined your collaboration invite`,
    headingText: `${c.actor} declined your collaboration invite`,
    button: { label: "Open the post", url: c.postUrl },
    reason: "You're getting this because of a collaboration you started on PinkQuill.",
  }),
  collaboration_removed: (input, c) => ({
    subject: `${c.actor} left your ${input.post?.type || "post"}`,
    headingHtml: `${c.actorHtml} removed themselves from ${c.postHtml}`,
    headingText: `${c.actor} removed themselves from ${c.post}`,
    button: { label: "Open the post", url: c.postUrl },
    reason: "You're getting this because of a collaboration you started on PinkQuill.",
  }),

  // ---- orders & commissions -----------------------------------------------
  order_pending_acceptance: (_i, c) => order(c, `New request: ${c.orderTitle}`, `${c.actorHtml} sent you a request`, `${c.actor} sent you a request`, "Accept or decline"),
  order_accepted: (_i, c) => order(c, `Request accepted — ${c.orderTitle}`, `${c.actorHtml} accepted your request`, `${c.actor} accepted your request`, "Pay to start"),
  order_declined: (_i, c) => order(c, `Request declined — ${c.orderTitle}`, `${c.actorHtml} declined your request`, `${c.actor} declined your request`, "Open order"),
  order_placed: (_i, c) => order(c, `New order: ${c.orderTitle}`, `${c.actorHtml} placed an order`, `${c.actor} placed an order`, "Open order"),
  order_paid: (_i, c) => order(c, `Paid: ${c.orderTitle} · ${c.amount}`, `${c.actorHtml} paid — you can start`, `${c.actor} paid — you can start`, "Open the workroom"),
  order_started: (_i, c) => order(c, `Work started on ${c.orderTitle}`, `${c.actorHtml} started your order`, `${c.actor} started your order`, "Open order"),
  order_delivered: (_i, c) => order(c, `Delivery ready: ${c.orderTitle}`, `${c.actorHtml} delivered your order`, `${c.actor} delivered your order`, "Review the delivery"),
  order_completed: (_i, c) => order(c, `Approved: ${c.orderTitle}`, `${c.actorHtml} approved the delivery`, `${c.actor} approved the delivery`, "Open order"),
  revision_requested: (_i, c) => order(c, `Revision requested: ${c.orderTitle}`, `${c.actorHtml} asked for a revision`, `${c.actor} asked for a revision`, "See what changed"),
  order_cancelled: (_i, c) => order(c, `Cancelled: ${c.orderTitle}`, "This order was cancelled", "This order was cancelled", "Open order", false),
  order_cancel_requested: (_i, c) => order(c, `Cancellation requested: ${c.orderTitle}`, `${c.actorHtml} asked to cancel`, `${c.actor} asked to cancel`, "Answer the request"),
  order_expired: (_i, c) => order(c, `Checkout expired: ${c.orderTitle}`, "Checkout expired before payment", "Checkout expired before payment", "Open order", false),
  order_payment_failed: (_i, c) => order(c, `Payment didn't go through: ${c.orderTitle}`, "Your payment didn't go through", "Your payment didn't go through", "Try again", false),
  review_received: (_i, c) => order(c, `New review from ${c.actor}`, `${c.actorHtml} left you a review`, `${c.actor} left you a review`, "Read the review"),
  order_message: (_i, c) => order(c, `New message on ${c.orderTitle}`, `${c.actorHtml} sent a message`, `${c.actor} sent a message`, "Reply"),
  order_disputed: (_i, c) => order(c, `Dispute opened: ${c.orderTitle}`, `${c.actorHtml} opened a dispute`, `${c.actor} opened a dispute`, "Add your side"),
  dispute_resolved: (_i, c) => order(c, `Dispute resolved: ${c.orderTitle}`, "The dispute was resolved", "The dispute was resolved", "Open order", false),
  refund_requested: (_i, c) => order(c, `Refund requested: ${c.orderTitle}`, `${c.actorHtml} asked for a refund`, `${c.actor} asked for a refund`, "Approve or decline"),
  refund_declined: (_i, c) => order(c, `Refund declined: ${c.orderTitle}`, `${c.actorHtml} declined the refund`, `${c.actor} declined the refund`, "Open order"),
  refund_approved: (_i, c) => order(c, `Refund approved: ${c.orderTitle}`, "Your refund is on its way", "Your refund is on its way", "Open order", false),
  order_refunded: (_i, c) => order(c, `Refunded: ${c.orderTitle}`, "This order was refunded", "This order was refunded", "Open order", false),
  order_transfer_failed: (_i, c) => order(c, `Payout needs attention: ${c.orderTitle}`, "A payout attempt failed", "A payout attempt failed", "Check payouts", false),
  chargeback_opened: (_i, c) => order(c, `Chargeback opened: ${c.orderTitle}`, "The buyer's bank opened a chargeback", "The buyer's bank opened a chargeback", "Open order", false),
  chargeback_closed: (_i, c) => order(c, `Chargeback closed: ${c.orderTitle}`, "The chargeback was closed", "The chargeback was closed", "Open order", false),
  order_due_soon: (_i, c) => order(c, `Due tomorrow: ${c.orderTitle}`, `Less than a day left${c.due ? ` · due ${esc(c.due)}` : ""}`, `Less than a day left${c.due ? ` · due ${c.due}` : ""}`, "Deliver work", false),
  order_due: (input, c) =>
    input.order?.role === "seller"
      ? order(c, `Due today: ${c.orderTitle}`, "This commission is due today", "This commission is due today", "Deliver or ask for time", false)
      : order(c, `Due today: ${c.orderTitle}`, "Your order was due today", "Your order was due today", "Open order", false),
  order_late: (input, c) =>
    input.order?.role === "seller"
      ? order(c, `Running late: ${c.orderTitle}`, "Two days past due", "Two days past due", "Deliver or ask for time", false)
      : order(c, `Running late: ${c.orderTitle}`, "Your order is two days late", "Your order is two days late", "See your options", false),
  extension_requested: (_i, c) => order(c, `More time requested: ${c.orderTitle}`, `${c.actorHtml} asked for more time`, `${c.actor} asked for more time`, "Accept or decline"),
  extension_accepted: (_i, c) => order(c, `New due date agreed: ${c.orderTitle}`, `${c.actorHtml} agreed to the new date`, `${c.actor} agreed to the new date`, "Open order"),
  extension_declined: (_i, c) => order(c, `Extension declined: ${c.orderTitle}`, `${c.actorHtml} kept the original date`, `${c.actor} kept the original date`, "Open order"),
};

function order(c: Ctx, subject: string, headingHtml: string, headingText: string, button: string, showActor = true): Copy {
  return { subject, headingHtml, headingText, button: { label: button, url: c.orderUrl }, reason: ORDER_REASON, showActor };
}

/** Every notification type that has email copy. */
export const EMAIL_TYPES: ReadonlySet<string> = new Set(Object.keys(COPY));

/** Kept for callers that only know order types. */
export const ORDER_EMAIL_TYPES: ReadonlySet<string> = new Set(Object.keys(COPY).filter((t) => emailCategoryForType(t)?.key === "orders"));

export function renderNotificationEmail(input: NotificationEmailInput): RenderedEmail | null {
  const copyFn = COPY[input.type];
  const category = emailCategoryForType(input.type);
  if (!copyFn || !category) return null;

  const actorName = input.actor?.name || (input.order ? (input.order.role === "seller" ? "The buyer" : "The creator") : "Someone");
  const phrase = postPhrase(input.post);
  const postUrl = input.post ? `${input.urls.base}/post/${input.post.id}` : input.actor?.username ? `${input.urls.base}/studio/${input.actor.username}` : input.urls.base;
  const orderTitle = input.order?.title || (input.order?.listingType === "service" ? "your commission" : "your order");
  const c: Ctx = {
    actor: actorName,
    actorHtml: strong(actorName),
    post: phrase.text,
    postHtml: phrase.html,
    postUrl,
    commentUrl: input.post && input.comment ? `${postUrl}?comment=${input.comment.id}` : postUrl,
    communityName: input.community?.name || "a community",
    communityUrl: input.community ? `${input.urls.base}/community/${input.community.slug}` : input.urls.base,
    profileUrl: input.actor?.username ? `${input.urls.base}/studio/${input.actor.username}` : input.urls.base,
    orderUrl: input.order ? `${input.urls.base}/orders/${input.order.id}` : input.urls.base,
    orderTitle,
    amount: money(input.order?.amount ?? null, input.order?.currency ?? null),
    due: date(input.order?.dueDate ?? null),
    base: input.urls.base,
  };
  const copy = copyFn(input, c);

  let facts: EmailFacts | null = null;
  const paragraphs = copy.paragraphs ? [...copy.paragraphs] : [];
  if (input.order) {
    const rows: EmailFacts["rows"] = [];
    if (input.order.number) rows.push(["Order", input.order.number]);
    if (input.order.title) rows.push([input.order.listingType === "service" ? "Commission" : "Listing", input.order.title]);
    if (c.amount) rows.push([input.order.role === "seller" ? "You receive" : "Total", c.amount]);
    if (c.due && input.order.listingType === "service") rows.push(["Due", c.due]);
    facts = { rows };
    if (input.content && !copy.quote) paragraphs.push(input.content);
  }

  return renderEmail({
    subject: copy.subject,
    headingHtml: copy.headingHtml,
    headingText: copy.headingText,
    actor: copy.showActor === false || !input.actor ? null : { name: input.actor.name, avatarUrl: input.actor.avatarUrl },
    greeting: input.order ? `Hi ${input.recipient.name},` : null,
    paragraphs,
    quote: copy.quote ?? null,
    facts,
    button: copy.button,
    reason: copy.reason,
    settingsUrl: input.urls.settings,
    unsubscribe: { label: `Unsubscribe from ${category.label.toLowerCase()} emails`, url: input.urls.unsubscribe },
    recipientEmail: input.recipient.email,
  });
}

// ---------------------------------------------------------------------------
// Direct-message digest
// ---------------------------------------------------------------------------

export interface DmDigestInput {
  recipient: { name: string; email: string | null };
  sender: { name: string; username: string | null; avatarUrl: string | null };
  /** Unread messages from the sender, oldest first. */
  messages: Array<{ content: string | null; type: string | null }>;
  conversationUrl: string;
  urls: { settings: string; unsubscribe: string };
}

function messagePreview(m: { content: string | null; type: string | null }): string {
  switch (m.type) {
    case "voice": return "Sent a voice message";
    case "media": return "Sent a photo or video";
    case "post_share": return "Shared a post with you";
    default: return truncate(m.content, 240) || "Sent you a message";
  }
}

export function renderDmDigestEmail(input: DmDigestInput): RenderedEmail {
  const count = input.messages.length;
  const latest = input.messages[input.messages.length - 1];
  const category = getEmailCategory("messages")!;
  const subject = count > 1 ? `${input.sender.name} sent you ${count} messages` : `${input.sender.name} sent you a message`;
  return renderEmail({
    subject,
    headingHtml: count > 1 ? `${strong(input.sender.name)} sent you ${count} messages` : `${strong(input.sender.name)} sent you a message`,
    headingText: subject,
    actor: { name: input.sender.name, avatarUrl: input.sender.avatarUrl },
    quote: latest ? messagePreview(latest) : null,
    paragraphs: count > 1 ? [`Showing the latest one. Open the conversation to read the rest.`] : [],
    button: { label: "Reply", url: input.conversationUrl },
    reason: "You're getting this because you have unread messages on PinkQuill.",
    settingsUrl: input.urls.settings,
    unsubscribe: { label: `Unsubscribe from ${category.label.toLowerCase()} emails`, url: input.urls.unsubscribe },
    recipientEmail: input.recipient.email,
  });
}
