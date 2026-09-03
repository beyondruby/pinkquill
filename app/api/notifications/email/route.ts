/**
 * Order email sender (Phase 2d).
 *
 * The notifications table has an AFTER INSERT trigger (queue_notification_email)
 * that POSTs {notification_id} here through pg_net with the cron secret, for
 * every notification tied to an order. This route decides whether to mail
 * (type has copy, recipient has not muted order emails, not already sent),
 * renders through lib/email/templates and sends through lib/email/send.
 *
 * Idempotent: the row is claimed by stamping emailed_at before sending; a
 * failed send clears the stamp and raises an ops alert. Never money-related.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCronSecret } from "@/lib/api-security";
import { reportOpsAlert } from "@/lib/ops";
import { sendEmail } from "@/lib/email/send";
import { ORDER_EMAIL_TYPES, renderOrderEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  order_id: string | null;
  content: string | null;
  emailed_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface ProfileRow { id: string; username: string | null; display_name: string | null; email_preferences: Record<string, boolean> | null }

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.pinkquill.com").replace(/\/$/, "");
}

function str(v: unknown): string | null { return typeof v === "string" && v ? v : null; }
function num(v: unknown): number | null { const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN; return Number.isFinite(n) ? n : null; }

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (!verifyCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notification_id?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }
  const id = body.notification_id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "notification_id required" }, { status: 400 });

  const { data: n, error: nErr } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, actor_id, type, order_id, content, emailed_at, metadata")
    .eq("id", id)
    .maybeSingle<NotificationRow>();
  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });
  if (!n) return NextResponse.json({ skipped: "not_found" });
  if (!n.order_id) return NextResponse.json({ skipped: "not_an_order" });
  if (n.emailed_at) return NextResponse.json({ skipped: "already_sent" });
  if (!ORDER_EMAIL_TYPES.has(n.type)) return NextResponse.json({ skipped: "no_template" });

  const [{ data: recipient }, { data: actor }, { data: authUser }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, username, display_name, email_preferences").eq("id", n.user_id).maybeSingle<ProfileRow>(),
    n.actor_id ? supabaseAdmin.from("profiles").select("id, username, display_name").eq("id", n.actor_id).maybeSingle<Pick<ProfileRow, "id" | "username" | "display_name">>() : Promise.resolve({ data: null }),
    supabaseAdmin.auth.admin.getUserById(n.user_id),
  ]);
  if (recipient?.email_preferences?.orders === false) return NextResponse.json({ skipped: "muted" });
  const to = authUser?.user?.email;
  if (!to) return NextResponse.json({ skipped: "no_email" });

  const meta = n.metadata ?? {};
  const role = str(meta.role) === "seller" ? "seller" : "buyer";
  const rendered = renderOrderEmail({
    type: n.type,
    role,
    recipientName: recipient?.display_name || recipient?.username || "there",
    actorName: actor?.display_name || actor?.username || (role === "seller" ? "The buyer" : "The creator"),
    content: n.content,
    orderUrl: `${baseUrl()}/orders/${n.order_id}`,
    settingsUrl: `${baseUrl()}/settings/notifications`,
    order: {
      number: str(meta.order_number), title: str(meta.title), amount: num(meta.amount), currency: str(meta.currency),
      dueDate: str(meta.due_date), listingType: str(meta.listing_type),
    },
  });
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

  const result = await sendEmail({ to, ...rendered });
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
