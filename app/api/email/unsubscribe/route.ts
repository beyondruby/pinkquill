/**
 * One-click unsubscribe. No sign-in: the link is signed per person and
 * category (lib/email/unsubscribe). GET renders a small confirmation page and
 * mutes the category; POST (RFC 8058 List-Unsubscribe-Post from mail clients)
 * mutes it and returns 200. A bad or missing token changes nothing.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";
import { getEmailCategory } from "@/lib/email/preferences";
import { BRAND, esc } from "@/lib/email/layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.pinkquill.com").replace(/\/$/, "");
}

function parse(url: URL) {
  const u = url.searchParams.get("u") || "";
  const c = url.searchParams.get("c") || "";
  const t = url.searchParams.get("t") || "";
  const validCategory = c === "all" || Boolean(getEmailCategory(c));
  const ok = /^[0-9a-f-]{36}$/i.test(u) && validCategory && verifyUnsubscribe(u, c, t);
  return { u, c, ok };
}

async function mute(userId: string, category: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("email_preferences").eq("id", userId).maybeSingle<{ email_preferences: Record<string, boolean> | null }>();
  if (!data) return false;
  const next = { ...(data.email_preferences ?? {}), [category]: false };
  const { error } = await supabaseAdmin.from("profiles").update({ email_preferences: next }).eq("id", userId);
  return !error;
}

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · PinkQuill</title>
<style>body{margin:0;background:${BRAND.ground};font-family:'Poppins','Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.ink}}main{max-width:480px;margin:12vh auto;padding:0 20px}.card{background:#fff;border:1px solid ${BRAND.line};border-radius:20px;padding:30px 32px}h1{font-size:22px;margin:0 0 10px}p{font-size:15px;line-height:1.6;color:${BRAND.body};margin:0 0 14px}a.btn{display:inline-block;background:${BRAND.accent};color:#fff;text-decoration:none;border-radius:999px;padding:12px 22px;font-weight:600;font-size:14px}a{color:${BRAND.accent}}.brand{display:flex;align-items:center;gap:10px;margin:0 6px 18px;font-weight:700;font-size:19px}.tile{width:34px;height:34px;border-radius:9px;background:${BRAND.gradient};color:#fff;display:grid;place-items:center;font-size:18px}</style></head>
<body><main><div class="brand"><span class="tile">&#10002;</span>PinkQuill</div><div class="card">${body}</div></main></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const { u, c, ok } = parse(new URL(request.url));
  const settings = `${baseUrl()}/settings/notifications`;
  if (!ok) {
    return page("Link not valid", `<h1>This link isn't valid</h1><p>It may have been cut off by your mail app. You can change what you get by email in your settings instead.</p><a class="btn" href="${esc(settings)}">Open email settings</a>`);
  }
  const done = await mute(u, c);
  const label = c === "all" ? "all PinkQuill notification emails" : `${getEmailCategory(c)!.label.toLowerCase()} emails`;
  if (!done) {
    return page("Something went wrong", `<h1>Something went wrong</h1><p>We couldn't update your preferences just now. Try again in a moment, or change them in your settings.</p><a class="btn" href="${esc(settings)}">Open email settings</a>`);
  }
  return page("Unsubscribed", `<h1>You're unsubscribed</h1><p>You'll no longer get ${esc(label)}. Everything still shows up in your notifications on PinkQuill.</p><a class="btn" href="${esc(settings)}">Manage email settings</a><p style="margin:16px 0 0;font-size:13px">Changed your mind? Turn it back on any time from the same page.</p>`);
}

export async function POST(request: Request) {
  const { u, c, ok } = parse(new URL(request.url));
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const done = await mute(u, c);
  return NextResponse.json(done ? { unsubscribed: c } : { error: "failed" }, { status: done ? 200 : 500 });
}
