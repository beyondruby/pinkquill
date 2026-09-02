"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Community, CommunityRule, CommunityTag } from "@/lib/types";

export interface CommunityContextValue {
  slug: string;
  community: Community | null;
  rules: CommunityRule[];
  tags: CommunityTag[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * The community layout fetches the community once and shares it here. Pages
 * under /community/[slug] used to call useCommunity() themselves — 2–3
 * instances per navigation, each 1 + 7 queries (findings L7).
 */
export const CommunityContext = createContext<CommunityContextValue | null>(null);

export function CommunityProvider({ value, children }: { value: CommunityContextValue; children: ReactNode }) {
  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunityContext(): CommunityContextValue | null {
  return useContext(CommunityContext);
}
