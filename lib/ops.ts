/**
 * Operational alerts for the money paths (Phase 1e). No Sentry in this
 * project: alerts land in ops_alerts and notify platform admins in-app.
 * Never throws — an alerting failure must not break the path being alerted on.
 */
import { supabaseAdmin } from "@/lib/supabase-server";

export type OpsSeverity = "info" | "warning" | "error" | "critical";

export async function reportOpsAlert(args: {
  kind: string;
  severity?: OpsSeverity;
  message: string;
  context?: Record<string, unknown>;
  orderId?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("alert_ops", {
      p_kind: args.kind,
      p_severity: args.severity ?? "error",
      p_message: args.message,
      p_context: args.context ?? {},
      p_order_id: args.orderId ?? null,
    });
    if (error) console.error("[ops] alert_ops failed:", error.message, args);
  } catch (err) {
    console.error("[ops] alert_ops threw:", err, args);
  }
}
