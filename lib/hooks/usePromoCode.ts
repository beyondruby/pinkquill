"use client";

import { useCallback, useState } from "react";
import { supabase } from "../supabase";

// ============================================================================
// PROMO CODE VALIDATION
// ============================================================================

export interface PromoCodeResult {
  valid: boolean;
  error?: string;
  promo_code_id?: string;
  code?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  discount_amount?: number;
  final_amount?: number;
}

export interface ApplyPromoResult {
  success: boolean;
  error?: string;
  original_amount?: number;
  discount_amount?: number;
  final_amount?: number;
  buyer_fee?: number;
  total_amount?: number;
}

export interface RemovePromoResult {
  success: boolean;
  error?: string;
  original_amount?: number;
  discount_amount?: number;
  final_amount?: number;
  buyer_fee?: number;
  total_amount?: number;
}

interface UseValidatePromoCodeReturn {
  result: PromoCodeResult | null;
  loading: boolean;
  error: string | null;
  validate: (code: string, amount: number, listingType?: string) => Promise<PromoCodeResult | null>;
  clear: () => void;
}

export function useValidatePromoCode(): UseValidatePromoCodeReturn {
  const [result, setResult] = useState<PromoCodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (
    code: string,
    amount: number,
    listingType?: string
  ): Promise<PromoCodeResult | null> => {
    if (!code.trim()) {
      setError("Please enter a promo code");
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const { data, error: rpcError } = await supabase.rpc("validate_promo_code", {
        p_code: code.trim(),
        p_amount: amount,
        p_listing_type: listingType || null,
      });

      if (rpcError) throw rpcError;

      const parsed = data as PromoCodeResult;
      setResult(parsed);

      if (!parsed.valid) {
        setError(parsed.error || "Invalid promo code");
      }

      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to validate promo code";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, validate, clear };
}

// ============================================================================
// APPLY PROMO CODE TO ORDER
// ============================================================================

interface UseApplyPromoCodeReturn {
  loading: boolean;
  error: string | null;
  apply: (orderId: string, promoCodeId: string) => Promise<ApplyPromoResult | null>;
}

export function useApplyPromoCode(): UseApplyPromoCodeReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (
    orderId: string,
    promoCodeId: string
  ): Promise<ApplyPromoResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("apply_promo_to_order", {
        p_order_id: orderId,
        p_promo_code_id: promoCodeId,
      });

      if (rpcError) throw rpcError;

      const result = data as ApplyPromoResult;
      if (!result.success) {
        setError(result.error || "Failed to apply promo code");
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply promo code";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, apply };
}

// ============================================================================
// REMOVE PROMO CODE FROM ORDER
// ============================================================================

interface UseRemovePromoCodeReturn {
  loading: boolean;
  error: string | null;
  remove: (orderId: string) => Promise<RemovePromoResult | null>;
}

export function useRemovePromoCode(): UseRemovePromoCodeReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (orderId: string): Promise<RemovePromoResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("remove_promo_from_order", {
        p_order_id: orderId,
      });

      if (rpcError) throw rpcError;

      const result = data as RemovePromoResult;
      if (!result.success) {
        setError(result.error || "Failed to remove promo code");
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove promo code";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, remove };
}
