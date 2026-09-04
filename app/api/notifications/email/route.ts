/**
 * Email sender for every notification and for direct-message digests.
 *
 * Two callers, both from the database through pg_net with the cron secret:
 *   - AFTER INSERT ON notifications → { notification_id }
 *   - the dm-digest cron            → { kind: "dm_digest", user_id, conversation_id, sender_id }
 *
 * This route decides whether to mail (the type has copy, the person wants
 * that category by email, the in-app category is not muted, not already sent,
 * not read yet, not too many this hour, not the same subject too recently),
 * renders through lib/email/templates and sends through lib/email/send.
 *
 * Idempotent: a notification row is claimed by stamping emailed_at before
 * sending; a failed send clears the stamp and raises an ops alert. Never
 * money-related.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCronSecret } from "@/lib/api-security";
import { reportOpsAlert } from "@/lib/ops";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_TYPES, renderDmDigestEmail, renderNotificationEmail, type NotificationEmailInput } from "@/lib/email/templates";
import { emailCategoryForType, shouldEmail, getEmailCategory } from "@/lib/email/preferences";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard ceiling on notification emails per person per hour, whatever they opted into. */
const HOURLY_CAP = 20;

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  order_id: string | null;
  content: string | null;
  read: boolean;
  emailed_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  notification_preferences: Record<string, boolean> | null;
  email_preferences: Record<string, boolean> | null;
}

interface Recipient {
  id: string;
  name: string;
  email: string | null;
  profile: ProfileRow | null;
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.pinkquill.com").replace(/\/$/, "");
}

function str(v: unknown): string | null { return typeof v === "string" && v ? v : null; }
function num(v: unknown): number | null { const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN; return Number.isFinite(n) ? n : null; }
function isUuid(v: unknown): v is string { return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v); }
function plain(html: string | null): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim() || null;
}

async function loadRecipient(userId: string): Promise<Recipient> {
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, email, notification_preferences, email_preferences")
      .eq("id", userId)
      .maybeSingle<ProfileRow>(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);
  return {
    id: userId,
    name: profile?.display_name || profile?.username || "there",
    email: authUser?.user?.email || profile?.email || null,
    profile: profile ?? null,
  };
}

function links(userId: string, category: string) {
  const base = baseUrl();
  return {
    base,
    settings: `${base}/settings/notifications`,
    unsubscribe: unsubscribeUrl(base, userId, category) ?? `${base}/settings/notifications`,
  };
}

async function overHourlyCap(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("emailed_at", since);
  return (count ?? 0) >= HOURLY_CAP;
}

/** True when an email about the same subject went out inside the category's quiet window. */
async function recentlyEmailedSameSubject(n: NotificationRow, minutes: number): Promise<boolean> {
  if (minutes <= 0) return false;
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  let query = supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", n.user_id)
    .neq("id", n.id)
    .gte("emailed_at", since);
  if (n.post_id) query = query.eq("post_id", n.post_id);
  else if (n.community_id) query = query.eq("community_id", n.community_id);
  else if (n.actor_id) query = query.eq("actor_id", n.actor_id);
  else return false;
  const { count } = await query;
  return (count ?? 0) > 0;
}

async function handleNotification(id: string) {
  const { data: n, error: nErr } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, actor_id, type, post_id, comment_id, community_id, order_id, content, read, emailed_at, metadata")
    .eq("id", id)
    .maybeSingle<NotificationRow>();
  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });
  if (!n) return NextResponse.json({ skipped: "not_found" });
  if (n.emailed_at) return NextResponse.json({ skipped: "already_sent" });
  if (!EMAIL_TYPES.has(n.type)) return NextResponse.json({ skipped: "no_template" });
  const category = emailCategoryForType(n.type);
  if (!category) return NextResponse.json({ skipped: "no_category" });
  if (n.read) return NextResponse.json({ skipped: "already_read" });

  const recipient = await loadRecipient(n.user_id);
  if (!shouldEmail(recipient.profile?.email_preferences, recipient.profile?.notification_preferences, category.key)) {
    return NextResponse.json({ skipped: "muted" });
  }
  if (!recipient.email) return NextResponse.json({ skipped: "no_email" });
  if (await overHourlyCap(n.user_id)) return NextResponse.json({ skipped: "rate_limited" });
  if (await recentlyEmailedSameSubject(n, category.coalesceMinutes)) return NextResponse.json({ skipped: "coalesced" });

  const [{ data: actor }, { data: post }, { data: comment }, { data: community }] = await Promise.all([
    n.actor_id
      ? supabaseAdmin.from("profiles").select("username, display_name, avatar_url").eq("id", n.actor_id).maybeSingle<{ username: string | null; display_name: string | null; avatar_url: string | null }>()
      : Promise.resolve({ data: null }),
    n.post_id
      ? supabaseAdmin.from("posts").select("id, title, type, content").eq("id", n.post_id).maybeSingle<{ id: string; title: string | null; type: string | null; content: string | null }>()
      : Promise.resolve({ data: null }),
    n.comment_id
      ? supabaseAdmin.from("comments").select("id, content").eq("id", n.comment_id).maybeSingle<{ id: string; content: string | null }>()
      : Promise.resolve({ data: null }),
    n.community_id
      ? supabaseAdmin.from("communities").select("name, slug").eq("id", n.community_id).maybeSingle<{ name: string; slug: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const meta = n.metadata ?? {};
  const input: NotificationEmailInput = {
    type: n.type,
    recipient: { name: recipient.name, email: recipient.email },
    actor: actor ? { name: actor.display_name || actor.username || "Someone", username: actor.username, avatarUrl: actor.avatar_url } : null,
    content: n.content,
    post: post ? { id: post.id, title: post.title, type: post.type, excerpt: plain(post.content) } : n.post_id ? { id: n.post_id, title: null, type: null, excerpt: null } : null,
    comment: comment ? { id: comment.id, content: comment.content } : n.comment_id ? { id: n.comment_id, content: null } : null,
    community: community ?? null,
    order: n.order_id
      ? {
          id: n.order_id,
          role: str(meta.role) === "seller" ? "seller" : "buyer",
          number: str(meta.order_number),
          title: str(meta.title),
          amount: num(meta.amount),
          currency: str(meta.currency),
          dueDate: str(meta.due_date),
          listingType: str(meta.listing_type),
        }
      : null,
    urls: links(n.user_id, category.key),
  };
  const rendered = renderNotificationEmail(input);
  if (!rendered) return NextResponse.json({ skipped: "no_template" });

  // Claim the row first so a duplicate delivery of the same webhook never double-sends.
  const { data: claimed } = await supabaseAdmin
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", n.id)
    .is("emailed_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ skipped: "already_sent" });

  const result = await sendEmail({ to: recipient.email, ...rendered, unsubscribeUrl: input.urls.unsubscribe, tags: { category: category.key, type: n.type } });
  if (!result.ok) {
    await supabaseAdmin.from("notifications").update({ emailed_at: null }).eq("id", n.id);
    await reportOpsAlert({ kind: "email_send_failed", severity: "warning", message: result.error, context: { notification_id: n.id, type: n.type }, orderId: n.order_id });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (result.skipped) {
    // No provider yet: leave the row unsent so it can go out once a key exists.
    await supabaseAdmin.from("notifications").update({ emailed_at: null }).eq("id", n.id);
    return NextResponse.json({ skipped: result.skipped });
  }
  return NextResponse.json({ sent: true, id: result.id });
}

async function handleDmDigest(userId: string, conversationId: string, senderId: string) {
  const category = getEmailCategory("messages")!;
  const { data: participant } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!participant) return NextResponse.json({ skipped: "not_a_participant" });

  const recipient = await loadRecipient(userId);
  if (!shouldEmail(recipient.profile?.email_preferences, recipient.profile?.notification_preferences, category.key)) {
    return NextResponse.json({ skipped: "muted" });
  }
  if (!recipient.email) return NextResponse.json({ skipped: "no_email" });

  const [{ data: messages }, { data: sender }] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .select("content, message_type, created_at")
      .eq("conversation_id", conversationId)
      .eq("sender_id", senderId)
      .eq("is_read", false)
      .order("created_at", { ascending: true })
      .limit(20),
    supabaseAdmin.from("profiles").select("username, display_name, avatar_url").eq("id", senderId).maybeSingle<{ username: string | null; display_name: string | null; avatar_url: string | null }>(),
  ]);
  if (!messages?.length) return NextResponse.json({ skipped: "nothing_unread" });

  const urls = links(userId, category.key);
  const rendered = renderDmDigestEmail({
    recipient: { name: recipient.name, email: recipient.email },
    sender: { name: sender?.display_name || sender?.username || "Someone", username: sender?.username ?? null, avatarUrl: sender?.avatar_url ?? null },
    messages: messages.map((m) => ({ content: m.content, type: m.message_type })),
    conversationUrl: `${urls.base}/messages?conversation=${conversationId}`,
    urls: { settings: urls.settings, unsubscribe: urls.unsubscribe },
  });
  const result = await sendEmail({ to: recipient.email, ...rendered, unsubscribeUrl: urls.unsubscribe, tags: { category: "messages", type: "dm_digest" } });
  if (!result.ok) {
    await reportOpsAlert({ kind: "email_send_failed", severity: "warning", message: result.error, context: { conversation_id: conversationId, user_id: userId, type: "dm_digest" } });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (result.skipped) return NextResponse.json({ skipped: result.skipped });
  return NextResponse.json({ sent: true, id: result.id, messages: messages.length });
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (!verifyCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { kind?: string; notification_id?: string; user_id?: string; conversation_id?: string; sender_id?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }

  if (body.kind === "dm_digest") {
    if (!isUuid(body.user_id) || !isUuid(body.conversation_id) || !isUuid(body.sender_id)) {
      return NextResponse.json({ error: "user_id, conversation_id and sender_id required" }, { status: 400 });
    }
    return handleDmDigest(body.user_id, body.conversation_id, body.sender_id);
  }

  if (!isUuid(body.notification_id)) return NextResponse.json({ error: "notification_id required" }, { status: 400 });
  return handleNotification(body.notification_id);
}
