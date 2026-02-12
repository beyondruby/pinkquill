"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

// ============================================================================
// TYPES
// ============================================================================

export interface SellerProfile {
  id: string;
  user_id: string;
  store_name: string;
  store_tagline: string | null;
  store_description: string | null;
  store_avatar_url: string | null;
  store_cover_url: string | null;
  specialties: string[];
  skills: string[];
  services: string[];
  experience_level: "beginner" | "intermediate" | "expert" | "professional" | null;
  response_time_hours: number;
  is_accepting_commissions: boolean;
  location: string | null;
  languages: string[];
  require_approval: boolean;
  auto_decline_hours: number;
  setup_completed: boolean;
  setup_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SellerProfileUpdate = Partial<Omit<SellerProfile, "id" | "user_id" | "created_at" | "updated_at">>;

// ============================================================================
// useSellerProfile — Fetch seller profile
// ============================================================================

interface UseSellerProfileReturn {
  profile: SellerProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSellerProfile(userId?: string): UseSellerProfileReturn {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetch_ = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      setProfile(data as SellerProfile | null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch seller profile";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetch_();
    return () => { mountedRef.current = false; };
  }, [fetch_]);

  return { profile, loading, error, refetch: fetch_ };
}

// ============================================================================
// useUpdateSellerProfile — Create or update
// ============================================================================

interface UseUpdateSellerProfileReturn {
  updating: boolean;
  error: string | null;
  update: (userId: string, data: SellerProfileUpdate) => Promise<SellerProfile | null>;
  create: (userId: string, data: SellerProfileUpdate & { store_name: string }) => Promise<SellerProfile | null>;
}

export function useUpdateSellerProfile(): UseUpdateSellerProfileReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (
    userId: string,
    data: SellerProfileUpdate & { store_name: string }
  ): Promise<SellerProfile | null> => {
    try {
      setUpdating(true);
      setError(null);

      const { data: result, error: insertError } = await supabase
        .from("seller_profiles")
        .insert({ user_id: userId, ...data })
        .select()
        .single();

      if (insertError) throw insertError;
      return result as SellerProfile;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create seller profile";
      setError(message);
      return null;
    } finally {
      setUpdating(false);
    }
  }, []);

  const update = useCallback(async (
    userId: string,
    data: SellerProfileUpdate
  ): Promise<SellerProfile | null> => {
    try {
      setUpdating(true);
      setError(null);

      const { data: result, error: updateError } = await supabase
        .from("seller_profiles")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) throw updateError;
      return result as SellerProfile;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update seller profile";
      setError(message);
      return null;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updating, error, update, create };
}

// ============================================================================
// useSellerSetupStatus — Quick check if setup is done
// ============================================================================

interface UseSellerSetupStatusReturn {
  setupCompleted: boolean | null;
  loading: boolean;
}

export function useSellerSetupStatus(userId?: string): UseSellerSetupStatusReturn {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSetupCompleted(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from("seller_profiles")
          .select("setup_completed")
          .eq("user_id", userId)
          .maybeSingle();
        setSetupCompleted(data?.setup_completed ?? false);
      } catch {
        setSetupCompleted(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return { setupCompleted, loading };
}
