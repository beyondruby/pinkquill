/** Short-lived signed URL for an evidence or order file, for operators (Phase 2f). The order-files bucket is private; participants use /api/orders/files. */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..") || !/^[A-Za-z0-9/_\-. ()]+$/.test(path)) return NextResponse.json({ error: "Bad path" }, { status: 400 });
  const { data, error } = await supabaseAdmin.storage.from("order-files").createSignedUrl(path, 300);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl });
}
