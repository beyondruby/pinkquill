"use client";

import { useCallback, useState } from "react";
import { supabase } from "../supabase";

/**
 * Due-date extensions (Phase 2d). The seller asks for more time on an active
 * commission; the buyer accepts (the order's due date moves and the reminder
 * ladder restarts) or declines. One pending request per order, decided by
 * the server (request_order_extension / respond_order_extension).
 */

export interface ExtensionResult { extension_id: string; status: "pending"; new_due_date: string; days: number }

function message(err: { message?: string } | null): string {
  return err?.message?.replace(/^.*?:\s*/, "") || "Something went wrong";
}

export function useRequestExtension() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestExtension = useCallback(async (orderId: string, newDueDate: string, reason?: string) => {
    setLoading(true); setError(null);
    const { data, error: rpcError } = await supabase.rpc("request_order_extension", {
      p_order_id: orderId, p_new_due_date: newDueDate, p_reason: reason?.trim() || null,
    });
    setLoading(false);
    if (rpcError) { setError(message(rpcError)); return null; }
    return data as ExtensionResult;
  }, []);
  return { requestExtension, loading, error };
}

export function useRespondExtension() {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const respondExtension = useCallback(async (extensionId: string, accept: boolean, note?: string) => {
    setLoading(accept ? "accept" : "decline"); setError(null);
    const { data, error: rpcError } = await supabase.rpc("respond_order_extension", {
      p_extension_id: extensionId, p_accept: accept, p_note: note?.trim() || null,
    });
    setLoading(null);
    if (rpcError) { setError(message(rpcError)); return null; }
    return data as { status: "accepted" | "declined"; due_date: string | null };
  }, []);
  return { respondExtension, loading, error };
}

export function useWithdrawExtension() {
  const [loading, setLoading] = useState(false);
  const withdrawExtension = useCallback(async (extensionId: string) => {
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("withdraw_order_extension", { p_extension_id: extensionId });
    setLoading(false);
    return !rpcError;
  }, []);
  return { withdrawExtension, loading };
}
