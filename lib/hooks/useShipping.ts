"use client";

import { useCallback, useState } from "react";
import { supabase } from "../supabase";

// ============================================================================
// useAddTracking — Seller adds tracking info to an order
// ============================================================================

interface UseAddTrackingReturn {
  addTracking: (orderId: string, trackingNumber: string, carrier?: string) => Promise<boolean>;
  adding: boolean;
  error: string | null;
}

export function useAddTracking(): UseAddTrackingReturn {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTracking = useCallback(
    async (orderId: string, trackingNumber: string, carrier?: string): Promise<boolean> => {
      setAdding(true);
      setError(null);

      try {
        const { error: rpcError } = await supabase.rpc("add_order_tracking", {
          p_order_id: orderId,
          p_tracking_number: trackingNumber,
          p_tracking_carrier: carrier || null,
        });

        if (rpcError) throw rpcError;
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[useAddTracking] Error:", message);
        setError(message);
        return false;
      } finally {
        setAdding(false);
      }
    },
    []
  );

  return { addTracking, adding, error };
}

// ============================================================================
// useConfirmDelivery — Buyer confirms delivery of a physical order
// ============================================================================

interface UseConfirmDeliveryReturn {
  confirmDelivery: (orderId: string) => Promise<boolean>;
  confirming: boolean;
  error: string | null;
}

export function useConfirmDelivery(): UseConfirmDeliveryReturn {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelivery = useCallback(async (orderId: string): Promise<boolean> => {
    setConfirming(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("confirm_order_delivery", {
        p_order_id: orderId,
      });

      if (rpcError) throw rpcError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useConfirmDelivery] Error:", message);
      setError(message);
      return false;
    } finally {
      setConfirming(false);
    }
  }, []);

  return { confirmDelivery, confirming, error };
}
