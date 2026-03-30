"use client";

import { useState, useCallback } from "react";
import { useValidatePromoCode, useApplyPromoCode, useRemovePromoCode } from "@/lib/hooks/usePromoCode";

interface PromoCodeInputProps {
  orderId: string;
  orderAmount: number;
  listingType?: string;
  onApplied?: (discountAmount: number, finalAmount: number) => void;
  onRemoved?: () => void;
}

export default function PromoCodeInput({
  orderId,
  orderAmount,
  listingType,
  onApplied,
  onRemoved,
}: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountInfo, setDiscountInfo] = useState<{
    discountAmount: number;
    finalAmount: number;
    discountType: string;
    discountValue: number;
  } | null>(null);

  const { result, loading: validating, error: validateError, validate, clear } = useValidatePromoCode();
  const { loading: applying, error: applyError, apply } = useApplyPromoCode();
  const { loading: removing, error: removeError, remove } = useRemovePromoCode();
  const asAmount = useCallback((value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }, []);

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;

    // First validate
    const validation = await validate(code, orderAmount, listingType);
    if (!validation?.valid || !validation.promo_code_id) return;

    // Then apply to order
    const applyResult = await apply(orderId, validation.promo_code_id);
    if (applyResult?.success) {
      const discountAmount = asAmount(applyResult.discount_amount ?? validation.discount_amount, 0);
      const finalAmount = asAmount(applyResult.final_amount ?? validation.final_amount, orderAmount);

      setAppliedCode(code.trim().toUpperCase());
      setDiscountInfo({
        discountAmount,
        finalAmount,
        discountType: validation.discount_type || "percentage",
        discountValue: validation.discount_value || 0,
      });
      onApplied?.(discountAmount, finalAmount);
    }
  }, [apply, asAmount, code, listingType, onApplied, orderAmount, orderId, validate]);

  const handleRemove = useCallback(async () => {
    const result = await remove(orderId);
    if (!result?.success) return;

    setAppliedCode(null);
    setDiscountInfo(null);
    setCode("");
    clear();
    onRemoved?.();
  }, [clear, onRemoved, orderId, remove]);

  const isLoading = validating || applying || removing;
  const error = validateError || applyError || removeError;

  // Applied state
  if (appliedCode && discountInfo) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {appliedCode}
            </span>
            <span className="text-sm text-green-700">
              {discountInfo.discountType === "percentage"
                ? `${discountInfo.discountValue}% off`
                : `$${discountInfo.discountAmount.toFixed(2)} off`}
            </span>
          </div>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-green-600 hover:text-green-800 underline"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
        <div className="mt-1 text-xs text-green-600">
          You save ${discountInfo.discountAmount.toFixed(2)}
        </div>
      </div>
    );
  }

  // Input state
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) clear();
          }}
          placeholder="Promo code"
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-purple-primary)] focus:ring-1 focus:ring-[var(--color-purple-primary)] outline-none disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
        />
        <button
          onClick={handleApply}
          disabled={isLoading || !code.trim()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "..." : "Apply"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {result?.valid && !appliedCode && (
        <p className="text-xs text-green-600">
          Discount: ${result.discount_amount?.toFixed(2)} off — New total: ${result.final_amount?.toFixed(2)}
        </p>
      )}
    </div>
  );
}
