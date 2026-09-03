/**
 * Shared bits for the admin API routes (Phase 2f). Every route verifies the
 * session, then the platform_admins row, then acts through service-role RPCs
 * that check the admin id again. Nothing here touches the money workers.
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isPlatformAdmin } from "@/lib/payments-server";

export async function requireAdmin(request: Request): Promise<{ user: { id: string; email?: string } } | { error: NextResponse }> {
  const user = await getAuthUser(request);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isPlatformAdmin(user.id))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user: { id: user.id, email: user.email } };
}

/** Call a service-role RPC and turn a Postgres error into a 400 with its message. */
export async function adminRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<{ data: T } | { error: NextResponse }> {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  if (error) {
    const message = error.message.replace(/^.*?:\s*/, "");
    return { error: NextResponse.json({ error: message }, { status: /admin/i.test(message) ? 403 : 400 }) };
  }
  return { data: data as T };
}

export function errorResponse(err: unknown, fallback: string, status = 400) {
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message }, { status });
}
