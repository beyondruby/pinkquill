"use client";

import { useState, useEffect, useCallback } from "react";
import type { PostStyling } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface DraftMedia {
  id: string;
  file?: File;
  preview: string;
  type: "image" | "video";
  caption?: string;
}

export interface DraftCollaborator {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role?: string;
}

export interface DraftMention {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface PostDraft {
  id: string;
  type: string;
  title: string;
  content: string;
  visibility: "public" | "private";
  contentWarning: string;
  collaborators: DraftCollaborator[];
  mentions: DraftMention[];
  communityId: string | null;
  communityName?: string;
  // Media is stored as metadata only (URLs for previews)
  // Actual files need to be re-uploaded
  mediaMetadata: Array<{
    id: string;
    preview: string;
    type: "image" | "video";
    caption?: string;
  }>;
  // Styling options (uses PostStyling from types)
  styling?: PostStyling;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

const DRAFTS_STORAGE_KEY = "pinkquill_drafts";
const MAX_DRAFTS = 10; // Limit to prevent localStorage bloat

// ============================================================================
// useDrafts - Manage post drafts in localStorage
// ============================================================================

interface UseDraftsReturn {
  drafts: PostDraft[];
  loading: boolean;
  saveDraft: (draft: Omit<PostDraft, "id" | "createdAt" | "updatedAt">, existingId?: string) => string;
  loadDraft: (id: string) => PostDraft | null;
  deleteDraft: (id: string) => void;
  clearAllDrafts: () => void;
  getMostRecentDraft: () => PostDraft | null;
  quotaExceeded: boolean;
}

export function useDrafts(): UseDraftsReturn {
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Load drafts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PostDraft[];
        // Sort by updatedAt (most recent first)
        parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setDrafts(parsed);
      }
    } catch (err) {
      console.error("[useDrafts] Failed to load drafts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save drafts to localStorage
  const persistDrafts = useCallback((newDrafts: PostDraft[]) => {
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(newDrafts));
      setQuotaExceeded(false);
    } catch (err) {
      console.error("[useDrafts] Failed to persist drafts:", err);
      // If storage is full, remove oldest drafts and notify user
      if (err instanceof Error && err.name === "QuotaExceededError") {
        setQuotaExceeded(true);
        const trimmed = newDrafts.slice(0, Math.floor(newDrafts.length / 2));
        try {
          localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(trimmed));
          setDrafts(trimmed);
        } catch {
          // If still failing, clear all drafts
          localStorage.removeItem(DRAFTS_STORAGE_KEY);
          setDrafts([]);
        }
      }
    }
  }, []);

  // Save a new draft or update existing
  const saveDraft = useCallback(
    (draft: Omit<PostDraft, "id" | "createdAt" | "updatedAt">, existingId?: string): string => {
      const now = new Date().toISOString();
      let draftId = existingId || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      setDrafts((current) => {
        let updated: PostDraft[];

        if (existingId) {
          // Update existing draft
          updated = current.map((d) =>
            d.id === existingId
              ? { ...d, ...draft, updatedAt: now }
              : d
          );
        } else {
          // Create new draft
          const newDraft: PostDraft = {
            ...draft,
            id: draftId,
            createdAt: now,
            updatedAt: now,
          };

          // Add to beginning, limit total drafts
          updated = [newDraft, ...current].slice(0, MAX_DRAFTS);
        }

        // Sort by updatedAt
        updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        persistDrafts(updated);
        return updated;
      });

      return draftId;
    },
    [persistDrafts]
  );

  // Load a specific draft
  const loadDraft = useCallback(
    (id: string): PostDraft | null => {
      return drafts.find((d) => d.id === id) || null;
    },
    [drafts]
  );

  // Delete a draft
  const deleteDraft = useCallback(
    (id: string) => {
      setDrafts((current) => {
        const updated = current.filter((d) => d.id !== id);
        persistDrafts(updated);
        return updated;
      });
    },
    [persistDrafts]
  );

  // Clear all drafts
  const clearAllDrafts = useCallback(() => {
    setDrafts([]);
    localStorage.removeItem(DRAFTS_STORAGE_KEY);
  }, []);

  // Get most recent draft
  const getMostRecentDraft = useCallback((): PostDraft | null => {
    return drafts.length > 0 ? drafts[0] : null;
  }, [drafts]);

  return {
    drafts,
    loading,
    saveDraft,
    loadDraft,
    deleteDraft,
    clearAllDrafts,
    getMostRecentDraft,
    quotaExceeded,
  };
}

// ============================================================================
// useAutoSave - Auto-save draft periodically while editing
// ============================================================================

interface UseAutoSaveOptions {
  enabled?: boolean;
  interval?: number; // milliseconds
  onSave?: (draftId: string) => void;
}

interface UseAutoSaveReturn {
  draftId: string | null;
  lastSaved: Date | null;
  isSaving: boolean;
  triggerSave: () => void;
}

export function useAutoSave(
  getDraftData: () => Omit<PostDraft, "id" | "createdAt" | "updatedAt"> | null,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const { enabled = true, interval = 30000, onSave } = options; // Default 30 seconds
  const { saveDraft } = useDrafts();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const triggerSave = useCallback(() => {
    const data = getDraftData();
    if (!data) return;

    // Don't save empty drafts
    if (!data.content.trim() && !data.title.trim() && data.mediaMetadata.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const id = saveDraft(data, draftId || undefined);
      setDraftId(id);
      setLastSaved(new Date());
      onSave?.(id);
    } finally {
      setIsSaving(false);
    }
  }, [getDraftData, saveDraft, draftId, onSave]);

  // Auto-save on interval
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      triggerSave();
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, interval, triggerSave]);

  return {
    draftId,
    lastSaved,
    isSaving,
    triggerSave,
  };
}
