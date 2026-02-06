"use client";

import { createContext, useContext } from "react";
import type { Community, CommunityRule, CommunityTag } from "@/lib/types";

interface CommunityContextType {
  community: Community;
  rules: CommunityRule[];
  tags: CommunityTag[];
  refetch: () => void;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export function useCommunityContext() {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error("useCommunityContext must be used within a CommunityProvider");
  }
  return context;
}

export function CommunityProvider({
  community,
  rules,
  tags,
  refetch,
  children,
}: CommunityContextType & { children: React.ReactNode }) {
  return (
    <CommunityContext.Provider value={{ community, rules, tags, refetch }}>
      {children}
    </CommunityContext.Provider>
  );
}
