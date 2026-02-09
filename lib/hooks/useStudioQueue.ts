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
  currency: string;
  image_url: string | null;
  added_at: string;
}

const STORAGE_KEY = "pinkquill.studio-queue.v1";

function readQueueFromStorage(): StudioQueueItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioQueueItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.id === "string");
  } catch {
    return [];
  }
}

function writeQueueToStorage(items: StudioQueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useStudioQueue() {
  const [items, setItems] = useState<StudioQueueItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readQueueFromStorage();
    setItems(initial);
    setHydrated(true);
  }, []);

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

      writeQueueToStorage(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId);
      writeQueueToStorage(next);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setItems([]);
    writeQueueToStorage([]);
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
    clearQueue,
    hasItem,
  };
}
