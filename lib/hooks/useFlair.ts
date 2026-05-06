/**
 * Flair Hooks
 * Handles community post flair/categorization functionality
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CommunityFlair } from "@/lib/types";

// ============================================================================
// useCommunityFlairs - Fetch flairs for a community
// ============================================================================

export function useCommunityFlairs(communityId: string | null) {
  const [flairs, setFlairs] = useState<CommunityFlair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlairs = useCallback(async () => {
    if (!communityId) {
      setFlairs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("community_flairs")
        .select("*")
        .eq("community_id", communityId)
        .order("position", { ascending: true });

      if (fetchError) throw fetchError;

      setFlairs(data || []);
    } catch (err) {
      console.error("Error fetching flairs:", err);
      setError("Failed to load flairs");
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchFlairs();
  }, [fetchFlairs]);

  return { flairs, loading, error, refetch: fetchFlairs };
}

// ============================================================================
// useManageFlairs - Admin CRUD operations for flairs
// ============================================================================

interface CreateFlairInput {
  name: string;
  color: string;
  emoji?: string | null;
}

interface UpdateFlairInput {
  id: string;
  name?: string;
  color?: string;
  emoji?: string | null;
  position?: number;
}

export function useManageFlairs(communityId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFlair = useCallback(
    async (input: CreateFlairInput): Promise<CommunityFlair | null> => {
      setLoading(true);
      setError(null);

      try {
        // Get current max position
        const { data: existing } = await supabase
          .from("community_flairs")
          .select("position")
          .eq("community_id", communityId)
          .order("position", { ascending: false })
          .limit(1);

        const highest = existing?.[0]?.position;
        const nextPosition = typeof highest === "number" ? highest + 1 : 0;

        const { data, error: createError } = await supabase
          .from("community_flairs")
          .insert({
            community_id: communityId,
            name: input.name,
            color: input.color,
            emoji: input.emoji || null,
            position: nextPosition,
          })
          .select()
          .single();

        if (createError) throw createError;

        return data;
      } catch (err) {
        console.error("Error creating flair:", err);
        setError("Failed to create flair");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [communityId]
  );

  const updateFlair = useCallback(
    async (input: UpdateFlairInput): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const updates: Partial<CommunityFlair> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.color !== undefined) updates.color = input.color;
        if (input.emoji !== undefined) updates.emoji = input.emoji;
        if (input.position !== undefined) updates.position = input.position;

        const { error: updateError } = await supabase
          .from("community_flairs")
          .update(updates)
          .eq("id", input.id);

        if (updateError) throw updateError;

        return true;
      } catch (err) {
        console.error("Error updating flair:", err);
        setError("Failed to update flair");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteFlair = useCallback(async (flairId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("community_flairs")
        .delete()
        .eq("id", flairId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      console.error("Error deleting flair:", err);
      setError("Failed to delete flair");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reorderFlairs = useCallback(
    async (flairIds: string[]): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // Update positions in batch
        const updates = flairIds.map((id, index) =>
          supabase
            .from("community_flairs")
            .update({ position: index })
            .eq("id", id)
        );

        await Promise.all(updates);

        return true;
      } catch (err) {
        console.error("Error reordering flairs:", err);
        setError("Failed to reorder flairs");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    createFlair,
    updateFlair,
    deleteFlair,
    reorderFlairs,
    loading,
    error,
  };
}

// ============================================================================
// usePostFlair - Set/remove flair on posts
// ============================================================================

export function usePostFlair() {
  const [loading, setLoading] = useState(false);

  const setFlair = useCallback(
    async (postId: string, flairId: string | null): Promise<boolean> => {
      setLoading(true);

      try {
        const { error } = await supabase
          .from("posts")
          .update({ flair_id: flairId })
          .eq("id", postId);

        if (error) throw error;

        return true;
      } catch (err) {
        console.error("Error setting post flair:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeFlair = useCallback(async (postId: string): Promise<boolean> => {
    return setFlair(postId, null);
  }, [setFlair]);

  return { setFlair, removeFlair, loading };
}
