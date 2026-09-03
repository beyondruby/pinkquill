"use client";

/**
 * Order workroom (Phase 2c): intake answers, reference files, revision
 * requests and versioned deliveries. Files go to the private `order-files`
 * bucket under orders/<orderId>/<kind>/…; only the bare path is stored and
 * the database refuses paths outside the order's folder. Reads resolve
 * short-lived signed URLs via useOrderFileUrls.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { OrderFileInput, OrderWorkroom } from "../types/store";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // order-files bucket limit

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

/** Upload files for an order and return the descriptors the RPCs expect. */
export async function uploadOrderFiles(
  orderId: string,
  kind: "reference" | "revision" | "delivery",
  files: File[]
): Promise<OrderFileInput[]> {
  const uploaded: OrderFileInput[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 100 MB`);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `orders/${orderId}/${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("order-files").upload(path, file, { upsert: false });
    if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
    uploaded.push({ path, name: file.name, type: file.type, size: file.size });
  }
  return uploaded;
}

export interface UseOrderWorkroomReturn {
  workroom: OrderWorkroom | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrderWorkroom(orderId?: string | null, enabled = true): UseOrderWorkroomReturn {
  const [workroom, setWorkroom] = useState<OrderWorkroom | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId && enabled));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!orderId || !enabled) {
      setWorkroom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_order_workroom", { p_order_id: orderId });
    if (rpcError) {
      setError(rpcError.message);
      setWorkroom(null);
    } else {
      setError(null);
      setWorkroom((data as OrderWorkroom | null) ?? null);
    }
    setLoading(false);
  }, [orderId, enabled]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { workroom, loading, error, refetch };
}

interface MutationState { loading: boolean; error: string | null }

export function useSubmitDelivery() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const submitDelivery = useCallback(async (orderId: string, note: string, files: File[], isFinal: boolean) => {
    setState({ loading: true, error: null });
    try {
      const uploaded = await uploadOrderFiles(orderId, "delivery", files);
      const { data, error } = await supabase.rpc("submit_order_delivery", {
        p_order_id: orderId, p_note: note.trim() || null, p_files: uploaded, p_is_final: isFinal,
      });
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as { delivery_id: string; version: number; files: number; status: string };
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, "Could not submit the delivery") });
      return null;
    }
  }, []);
  return { submitDelivery, ...state };
}

export function useRequestRevision() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const requestRevision = useCallback(async (orderId: string, note: string, files: File[]) => {
    setState({ loading: true, error: null });
    try {
      const uploaded = await uploadOrderFiles(orderId, "revision", files);
      const { data, error } = await supabase.rpc("request_order_revision", {
        p_order_id: orderId, p_note: note.trim() || null, p_files: uploaded,
      });
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as { revision_id: string; number: number; files: number; status: string };
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, "Could not request a revision") });
      return null;
    }
  }, []);
  return { requestRevision, ...state };
}

export function useAddReferences() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const addReferences = useCallback(async (orderId: string, files: File[]) => {
    if (files.length === 0) return { added: 0, total: 0 };
    setState({ loading: true, error: null });
    try {
      const uploaded = await uploadOrderFiles(orderId, "reference", files);
      const { data, error } = await supabase.rpc("add_order_references", { p_order_id: orderId, p_files: uploaded });
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as { added: number; total: number };
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, "Could not add reference files") });
      return null;
    }
  }, []);
  return { addReferences, ...state };
}
