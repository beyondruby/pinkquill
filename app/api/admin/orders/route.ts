/** Admin orders search (Phase 2f): one RPC across number, listing, buyer, seller, payment id. */
import { NextResponse } from "next/server";
import { adminRpc, requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const url = new URL(request.url);
  const r = await adminRpc("admin_search_orders", {
    p_q: url.searchParams.get("q") ?? null,
    p_status: url.searchParams.get("status") ?? null,
    p_limit: Number(url.searchParams.get("limit") ?? 50) || 50,
  });
  if ("error" in r) return r.error;
  return NextResponse.json({ orders: r.data ?? [] });
}
