/** Platform settings editor (Phase 2f): GET all, POST { key, value } through the validated RPC. */
import { NextResponse } from "next/server";
import { enforceSameOrigin, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { adminRpc, requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const { data, error } = await supabaseAdmin.from("platform_settings").select("key, value, updated_at").order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: history } = await supabaseAdmin.from("ops_alerts").select("id, message, context, created_at").eq("kind", "admin_action").eq("message", "setting_changed").order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ settings: data ?? [], history: history ?? [] });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const parsed = await safeJsonParse<{ key?: string; value?: unknown }>(request);
  if ("error" in parsed) return parsed.error;
  const { key, value } = parsed.data;
  if (!key || value === undefined) return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  const r = await adminRpc("admin_update_setting", { p_key: key, p_value: value, p_admin_id: gate.user.id });
  if ("error" in r) return r.error;
  return NextResponse.json({ success: true, result: r.data });
}
