"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { Collection, CollectionRef, Post } from "../types";
import { POST_COUNTS_SELECT, enrichPost, fetchUserPostFlags } from "../posts/enrich";

// Collections are one level deep: a collection holds works (posts) through
// collection_posts. Every write goes through a SECURITY DEFINER RPC
// (supabase/migrations/20260915_collections_phase1_flatten.sql); reads use
// the shelf RPC or plain selects under RLS.

// ============================================================================
// useCollections — a user's shelf (get_studio_collections)
// ============================================================================

interface UseCollectionsReturn {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCollections(userId?: string, options: { enabled?: boolean } = {}): UseCollectionsReturn {
  const enabled = options.enabled ?? true;
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const mountedRef = useRef(true);
  const fetchedUserRef = useRef<string | null>(null);

  const fetchCollections = useCallback(async () => {
    if (!userId) {
      fetchedUserRef.current = null;
      setCollections([]);
      setLoading(false);
      return;
    }
    // Disabled = the tab is not open: keep whatever is loaded (P-11).
    if (!enabled) {
      if (!fetchedRef.current) setLoading(false);
      return;
    }
    try {
      if (!fetchedRef.current) setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("get_studio_collections", { p_user_id: userId });
      if (!mountedRef.current) return;
      if (rpcError) throw rpcError;
      setCollections((data as Collection[] | null) ?? []);
      fetchedRef.current = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCollections] Error:", message);
      if (mountedRef.current) setError(message || "Failed to fetch collections");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    // One fetch per user while enabled; mutations call refetch() explicitly.
    if (enabled && userId && fetchedUserRef.current === userId) return;
    if (enabled && userId) fetchedUserRef.current = userId;
    fetchCollections();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCollections, enabled, userId]);

  return { collections, loading, error, refetch: fetchCollections };
}

// ============================================================================
// useCollectionBySlug — one collection by owner + slug (public read)
// ============================================================================

interface UseCollectionReturn {
  collection: Collection | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCollectionBySlug(userId?: string, slug?: string): UseCollectionReturn {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCollection = useCallback(async () => {
    if (!userId || !slug) {
      setCollection(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // The shelf RPC already carries counts and previews; pick the one row.
      const { data, error: rpcError } = await supabase.rpc("get_studio_collections", { p_user_id: userId });
      if (!mountedRef.current) return;
      if (rpcError) throw rpcError;
      const row = ((data as Collection[] | null) ?? []).find((c) => c.slug === slug) ?? null;
      setCollection(row);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCollectionBySlug] Error:", message);
      if (mountedRef.current) setError(message || "Failed to fetch collection");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId, slug]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCollection();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCollection]);

  return { collection, loading, error, refetch: fetchCollection };
}

// ============================================================================
// useCollectionWorks — the posts in a collection, in shelf order, with the
// viewer's flags (same load as the Saved page: enrichPost + fetchUserPostFlags)
// ============================================================================

interface UseCollectionWorksReturn {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const WORKS_SELECT = `
  *,
  author:profiles!posts_author_id_fkey ( id, username, display_name, avatar_url ),
  media:post_media ( id, media_url, media_type, caption, position ),
  community:communities ( slug, name, avatar_url ),
  flair:community_flairs ( id, community_id, name, color, emoji, position, created_at ),
  ${POST_COUNTS_SELECT}`;

export function useCollectionWorks(collectionId?: string | null, viewerId?: string | null): UseCollectionWorksReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchWorks = useCallback(async () => {
    if (!collectionId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data: links, error: linksError } = await supabase
        .from("collection_posts")
        .select("post_id, position")
        .eq("collection_id", collectionId)
        .order("position", { ascending: true });
      if (!mountedRef.current) return;
      if (linksError) throw linksError;
      const ids = (links ?? []).map((l) => l.post_id as string);
      if (ids.length === 0) {
        setPosts([]);
        return;
      }
      const [{ data: rows, error: postsError }, flags] = await Promise.all([
        supabase.from("posts").select(WORKS_SELECT).in("id", ids),
        fetchUserPostFlags(viewerId, ids),
      ]);
      if (!mountedRef.current) return;
      if (postsError) throw postsError;
      const byId = new Map((rows ?? []).map((r) => [String((r as { id: string }).id), enrichPost(r, flags)]));
      setPosts(ids.map((id) => byId.get(id)).filter((p): p is Post => !!p));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCollectionWorks] Error:", message);
      if (mountedRef.current) setError(message || "Failed to load works");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [collectionId, viewerId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchWorks();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchWorks]);

  return { posts, setPosts, loading, error, refetch: fetchWorks };
}

// ============================================================================
// usePostCollections — the collections a post sits in ("Part of …")
// ============================================================================

export function usePostCollections(postId?: string | null): { refs: CollectionRef[]; refetch: () => Promise<void> } {
  const [refs, setRefs] = useState<CollectionRef[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_post_collections", { p_post_id: postId });
      if (cancelled) return;
      if (error) {
        console.error("[usePostCollections] Error:", error.message);
        return;
      }
      setRefs((data as CollectionRef[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, tick]);

  const refetch = useCallback(async () => setTick((t) => t + 1), []);
  return { refs: postId ? refs : [], refetch };
}

// ============================================================================
// useOwnWorks — the signed-in user's own posts, for the "Add works" sheet
// ============================================================================

export interface OwnWork {
  id: string;
  type: string;
  title: string | null;
  content: string;
  created_at: string;
  image_url: string | null;
}

export function useOwnWorks(userId?: string | null, enabled = true): { works: OwnWork[]; loading: boolean } {
  // null = not loaded yet; loading is derived from it (no setState in the effect body).
  const [works, setWorks] = useState<OwnWork[] | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!userId || !enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, type, title, content, created_at, media:post_media ( media_url, media_type, position )")
        .eq("author_id", userId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled || !mountedRef.current) return;
      if (error) {
        console.error("[useOwnWorks] Error:", error.message);
        setWorks([]);
        return;
      }
      setWorks(
        ((data ?? []) as Array<OwnWork & { media?: { media_url: string; media_type: string; position: number }[] }>).map((row) => {
          const image = [...(row.media ?? [])]
            .sort((a, b) => a.position - b.position)
            .find((m) => m.media_type === "image");
          return { id: row.id, type: row.type, title: row.title, content: row.content, created_at: row.created_at, image_url: image?.media_url ?? null };
        })
      );
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [userId, enabled]);

  return { works: works ?? [], loading: !!userId && enabled && works === null };
}

// ============================================================================
// useCollectionMutations — every write, through the RPCs
// ============================================================================

export interface SaveCollectionInput {
  id?: string;
  name: string;
  description?: string | null;
  iconEmoji?: string | null;
  iconUrl?: string | null;
  coverUrl?: string | null;
}

interface UseCollectionMutationsReturn {
  saveCollection: (input: SaveCollectionInput) => Promise<Collection | null>;
  deleteCollection: (id: string) => Promise<boolean>;
  reorderCollections: (ids: string[]) => Promise<boolean>;
  setPostCollections: (postId: string, collectionIds: string[]) => Promise<boolean>;
  addPostsToCollection: (collectionId: string, postIds: string[]) => Promise<boolean>;
  removePostFromCollection: (collectionId: string, postId: string) => Promise<boolean>;
  reorderCollectionPosts: (collectionId: string, postIds: string[]) => Promise<boolean>;
  busy: boolean;
  error: string | null;
}

export function useCollectionMutations(): UseCollectionMutationsReturn {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: string, args: Record<string, unknown>): Promise<{ data: unknown; ok: boolean }> => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(fn, args);
      if (rpcError) {
        console.error(`[useCollectionMutations] ${fn}:`, rpcError.message);
        setError(rpcError.message);
        return { data: null, ok: false };
      }
      return { data, ok: true };
    } finally {
      setBusy(false);
    }
  }, []);

  const saveCollection = useCallback(async (input: SaveCollectionInput) => {
    const { data, ok } = await run("save_collection", {
      p_name: input.name,
      p_id: input.id ?? null,
      p_description: input.description ?? null,
      p_icon_emoji: input.iconEmoji ?? null,
      p_icon_url: input.iconUrl ?? null,
      p_cover_url: input.coverUrl ?? null,
    });
    return ok ? (data as Collection) : null;
  }, [run]);

  const deleteCollection = useCallback(async (id: string) => (await run("delete_collection", { p_id: id })).ok, [run]);
  const reorderCollections = useCallback(async (ids: string[]) => (await run("reorder_collections", { p_ids: ids })).ok, [run]);
  const setPostCollections = useCallback(
    async (postId: string, collectionIds: string[]) => (await run("set_post_collections", { p_post_id: postId, p_collection_ids: collectionIds })).ok,
    [run]
  );
  const addPostsToCollection = useCallback(
    async (collectionId: string, postIds: string[]) => (await run("add_posts_to_collection", { p_collection_id: collectionId, p_post_ids: postIds })).ok,
    [run]
  );
  const removePostFromCollection = useCallback(
    async (collectionId: string, postId: string) => (await run("remove_post_from_collection", { p_collection_id: collectionId, p_post_id: postId })).ok,
    [run]
  );
  const reorderCollectionPosts = useCallback(
    async (collectionId: string, postIds: string[]) => (await run("reorder_collection_posts", { p_collection_id: collectionId, p_post_ids: postIds })).ok,
    [run]
  );

  return { saveCollection, deleteCollection, reorderCollections, setPostCollections, addPostsToCollection, removePostFromCollection, reorderCollectionPosts, busy, error };
}
