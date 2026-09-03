"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ListingType, ProductDelivery } from "../types/store";

export interface StudioQueueItem {
  id: string;
  product_id: string;
  pricing_id: string;
  listing_type: ListingType;
  delivery_type: ProductDelivery;
  title: string;
  seller_name: string;
  price: number;
  min_price?: number;
  chosen_amount?: number | null;
  currency: string;
  image_url: string | null;
  added_at: string;
}

const STORAGE_KEY = "pinkquill.studio-cart.v1";
const OLD_STORAGE_KEY = "pinkquill.studio-queue.v1";

function readCartFromStorage(): StudioQueueItem[] {
  if (typeof window === "undefined") return [];

  try {
    // Migrate from old key if new key doesn't exist yet
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const oldRaw = window.localStorage.getItem(OLD_STORAGE_KEY);
      if (oldRaw) {
        window.localStorage.setItem(STORAGE_KEY, oldRaw);
        window.localStorage.removeItem(OLD_STORAGE_KEY);
        raw = oldRaw;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioQueueItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.id === "string");
  } catch {
    return [];
  }
}

function writeCartToStorage(items: StudioQueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function useStudioCartInternal() {
  const [items, setItems] = useState<StudioQueueItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrating localStorage-backed cart after mount */
  useEffect(() => {
    const initial = readCartFromStorage();
    setItems(initial);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addItem = useCallback((item: Omit<StudioQueueItem, "id" | "added_at">) => {
    setItems((prev) => {
      const id = `${item.product_id}:${item.pricing_id}`;
      const existingIndex = prev.findIndex((entry) => entry.id === id);
      const nextItem: StudioQueueItem = {
        ...item,
        id,
        added_at: new Date().toISOString(),
      };

      let next: StudioQueueItem[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = nextItem;
      } else {
        next = [nextItem, ...prev];
      }

      writeCartToStorage(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId);
      writeCartToStorage(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    writeCartToStorage([]);
  }, []);

  const hasItem = useCallback((productId: string, pricingId: string) => {
    const itemId = `${productId}:${pricingId}`;
    return items.some((item) => item.id === itemId);
  }, [items]);

  const count = useMemo(() => items.length, [items.length]);

  return {
    items,
    count,
    hydrated,
    addItem,
    removeItem,
    clearCart,
    /** @deprecated Use clearCart instead */
    clearQueue: clearCart,
    hasItem,
  };
}

/** Primary export — use this for new code */
export const useStudioCart = useStudioCartInternal;

/** @deprecated Use useStudioCart instead */
