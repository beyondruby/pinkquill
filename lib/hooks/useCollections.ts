"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type {
  Collection,
  CollectionItem,
  CollectionItemPost,
  CollectionWithItems,
  CollectionItemMetadata,
} from "../types";

// ============================================================================
// SLUG HELPER
// ============================================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

// ============================================================================
// useCollections - Fetch all collections for a user
// ============================================================================

interface UseCollectionsReturn {
  collections: CollectionWithItems[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCollections(userId?: string): UseCollectionsReturn {
  const [collections, setCollections] = useState<CollectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchCollections = useCallback(async () => {
    if (!userId) {
      setCollections([]);
      setLoading(false);
      return;
    }

    try {
      if (!fetchedRef.current) {
        setLoading(true);
      }
      setError(null);

      // Fetch collections with items
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select(`
          *,
          items:collection_items (
            *,
            posts:collection_item_posts (count)
          )
        `)
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (collectionsError) throw collectionsError;

      // Transform data
      const transformedCollections: CollectionWithItems[] = (collectionsData || []).map((col: any) => ({
        ...col,
        items_count: col.items?.length || 0,
        items: (col.items || [])
          .map((item: any) => ({
            ...item,
            posts_count: item.posts?.[0]?.count || 0,
          }))
          .sort((a: CollectionItem, b: CollectionItem) => a.position - b.position),
      }));

      setCollections(transformedCollections);
      fetchedRef.current = true;
    } catch (err: any) {
      console.error("[useCollections] Error:", err?.message || err);
      setError(err?.message || "Failed to fetch collections");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, error, refetch: fetchCollections };
}

// ============================================================================
// useCollection - Fetch a single collection by slug
// ============================================================================

interface UseCollectionReturn {
  collection: CollectionWithItems | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCollection(userId?: string, slug?: string): UseCollectionReturn {
  const [collection, setCollection] = useState<CollectionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async () => {
    if (!userId || !slug) {
      setCollection(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("collections")
        .select(`
          *,
          items:collection_items (
            *,
            posts:collection_item_posts (
              *,
              post:posts (
                id, title, type, content, created_at,
                author:profiles!posts_author_id_fkey (username, display_name, avatar_url),
                media:post_media (id, media_url, media_type)
              )
            )
          )
        `)
        .eq("user_id", userId)
        .eq("slug", slug)
        .single();

      if (fetchError) throw fetchError;

      // Transform data
      const transformedCollection: CollectionWithItems = {
        ...data,
        items_count: data.items?.length || 0,
        items: (data.items || [])
          .map((item: any) => ({
            ...item,
            posts_count: item.posts?.length || 0,
            posts: (item.posts || []).sort(
              (a: CollectionItemPost, b: CollectionItemPost) => a.position - b.position
            ),
          }))
          .sort((a: CollectionItem, b: CollectionItem) => a.position - b.position),
      };

      setCollection(transformedCollection);
    } catch (err: any) {
      console.error("[useCollection] Error:", err?.message || err);
      setError(err?.message || "Failed to fetch collection");
    } finally {
      setLoading(false);
    }
  }, [userId, slug]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  return { collection, loading, error, refetch: fetchCollection };
}

// ============================================================================
// useCollectionItem - Fetch a single collection item by slug
// ============================================================================

interface UseCollectionItemReturn {
  item: CollectionItem | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCollectionItem(
  userId?: string,
  collectionSlug?: string,
  itemSlug?: string
): UseCollectionItemReturn {
  const [item, setItem] = useState<CollectionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    if (!userId || !collectionSlug || !itemSlug) {
      setItem(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First get the collection
      const { data: collectionData, error: collectionError } = await supabase
        .from("collections")
        .select("id, name, slug")
        .eq("user_id", userId)
        .eq("slug", collectionSlug)
        .single();

      if (collectionError) throw collectionError;

      // Then get the item with posts
      const { data: itemData, error: itemError } = await supabase
        .from("collection_items")
        .select(`
          *,
          posts:collection_item_posts (
            *,
            post:posts (
              id, title, type, content, created_at, visibility,
              styling, metadata, post_location,
              author:profiles!posts_author_id_fkey (id, username, display_name, avatar_url, is_verified),
              media:post_media (id, media_url, media_type, caption, position)
            )
          )
        `)
        .eq("collection_id", collectionData.id)
        .eq("slug", itemSlug)
        .single();

      if (itemError) throw itemError;

      const transformedItem: CollectionItem = {
        ...itemData,
        collection: collectionData,
        posts_count: itemData.posts?.length || 0,
        posts: (itemData.posts || []).sort(
          (a: CollectionItemPost, b: CollectionItemPost) => a.position - b.position
        ),
      };

      setItem(transformedItem);
    } catch (err: any) {
      console.error("[useCollectionItem] Error:", err?.message || err);
      setError(err?.message || "Failed to fetch collection item");
    } finally {
      setLoading(false);
    }
  }, [userId, collectionSlug, itemSlug]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  return { item, loading, error, refetch: fetchItem };
}

// ============================================================================
// useCreateCollection - Create a new collection
// ============================================================================

interface UseCreateCollectionReturn {
  createCollection: (
    name: string,
    options?: {
      description?: string;
      iconUrl?: string;
      iconEmoji?: string;
      coverUrl?: string;
    }
  ) => Promise<Collection | null>;
  creating: boolean;
  error: string | null;
}

export function useCreateCollection(userId?: string): UseCreateCollectionReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCollection = useCallback(
    async (
      name: string,
      options?: {
        description?: string;
        iconUrl?: string;
        iconEmoji?: string;
        coverUrl?: string;
      }
    ): Promise<Collection | null> => {
      if (!userId) {
        setError("Not authenticated");
        return null;
      }

      try {
        setCreating(true);
        setError(null);

        // Get current max position
        const { data: existing } = await supabase
          .from("collections")
          .select("position")
          .eq("user_id", userId)
          .order("position", { ascending: false })
          .limit(1);

        const nextPosition = existing?.[0]?.position != null ? existing[0].position + 1 : 0;

        // Generate unique slug
        let slug = generateSlug(name);
        let slugSuffix = 0;
        let isUnique = false;

        while (!isUnique) {
          const testSlug = slugSuffix === 0 ? slug : `${slug}-${slugSuffix}`;
          const { data: existingSlug } = await supabase
            .from("collections")
            .select("id")
            .eq("user_id", userId)
            .eq("slug", testSlug)
            .single();

          if (!existingSlug) {
            slug = testSlug;
            isUnique = true;
          } else {
            slugSuffix++;
          }
        }

        const { data, error: insertError } = await supabase
          .from("collections")
          .insert({
            user_id: userId,
            name,
            slug,
            description: options?.description || null,
            icon_url: options?.iconUrl || null,
            icon_emoji: options?.iconEmoji || null,
            cover_url: options?.coverUrl || null,
            position: nextPosition,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return data;
      } catch (err: any) {
        console.error("[useCreateCollection] Error:", err?.message || err);
        setError(err?.message || "Failed to create collection");
        return null;
      } finally {
        setCreating(false);
      }
    },
    [userId]
  );

  return { createCollection, creating, error };
}

// ============================================================================
// useCreateCollectionItem - Create a new item in a collection
// ============================================================================

interface UseCreateCollectionItemReturn {
  createItem: (
    collectionId: string,
    name: string,
    options?: {
      description?: string;
      coverUrl?: string;
      iconEmoji?: string;
      metadata?: CollectionItemMetadata;
    }
  ) => Promise<CollectionItem | null>;
  creating: boolean;
  error: string | null;
}

export function useCreateCollectionItem(userId?: string): UseCreateCollectionItemReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createItem = useCallback(
    async (
      collectionId: string,
      name: string,
      options?: {
        description?: string;
        coverUrl?: string;
        iconEmoji?: string;
        metadata?: CollectionItemMetadata;
      }
    ): Promise<CollectionItem | null> => {
      if (!userId) {
        setError("Not authenticated");
        return null;
      }

      try {
        setCreating(true);
        setError(null);

        // Get current max position in collection
        const { data: existing } = await supabase
          .from("collection_items")
          .select("position")
          .eq("collection_id", collectionId)
          .order("position", { ascending: false })
          .limit(1);

        const nextPosition = existing?.[0]?.position != null ? existing[0].position + 1 : 0;

        // Generate unique slug within collection
        let slug = generateSlug(name);
        let slugSuffix = 0;
        let isUnique = false;

        while (!isUnique) {
          const testSlug = slugSuffix === 0 ? slug : `${slug}-${slugSuffix}`;
          const { data: existingSlug } = await supabase
            .from("collection_items")
            .select("id")
            .eq("collection_id", collectionId)
            .eq("slug", testSlug)
            .single();

          if (!existingSlug) {
            slug = testSlug;
            isUnique = true;
          } else {
            slugSuffix++;
          }
        }

        const { data, error: insertError } = await supabase
          .from("collection_items")
          .insert({
            collection_id: collectionId,
            user_id: userId,
            name,
            slug,
            description: options?.description || null,
            cover_url: options?.coverUrl || null,
            icon_emoji: options?.iconEmoji || null,
            metadata: options?.metadata || {},
            position: nextPosition,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return data;
      } catch (err: any) {
        console.error("[useCreateCollectionItem] Error:", err?.message || err);
        setError(err?.message || "Failed to create collection item");
        return null;
      } finally {
        setCreating(false);
      }
    },
    [userId]
  );

  return { createItem, creating, error };
}

// ============================================================================
// useAddPostToCollectionItem - Add a post to a collection item
// ============================================================================

interface UseAddPostToCollectionItemReturn {
  addPost: (collectionItemId: string, postId: string) => Promise<boolean>;
  removePost: (collectionItemId: string, postId: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useAddPostToCollectionItem(): UseAddPostToCollectionItemReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPost = useCallback(
    async (collectionItemId: string, postId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        // Get current max position
        const { data: existing } = await supabase
          .from("collection_item_posts")
          .select("position")
          .eq("collection_item_id", collectionItemId)
          .order("position", { ascending: false })
          .limit(1);

        const nextPosition = existing?.[0]?.position != null ? existing[0].position + 1 : 0;

        const { error: insertError } = await supabase
          .from("collection_item_posts")
          .insert({
            collection_item_id: collectionItemId,
            post_id: postId,
            position: nextPosition,
          });

        if (insertError) throw insertError;

        return true;
      } catch (err: any) {
        console.error("[useAddPostToCollectionItem] Error:", err?.message || err);
        setError(err?.message || "Failed to add post to collection");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removePost = useCallback(
    async (collectionItemId: string, postId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const { error: deleteError } = await supabase
          .from("collection_item_posts")
          .delete()
          .eq("collection_item_id", collectionItemId)
          .eq("post_id", postId);

        if (deleteError) throw deleteError;

        return true;
      } catch (err: any) {
        console.error("[useAddPostToCollectionItem] Remove error:", err?.message || err);
        setError(err?.message || "Failed to remove post from collection");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { addPost, removePost, loading, error };
}

// ============================================================================
// useUpdateCollection - Update collection details
// ============================================================================

interface UseUpdateCollectionReturn {
  updateCollection: (
    collectionId: string,
    updates: Partial<{
      name: string;
      description: string | null;
      icon_url: string | null;
      icon_emoji: string | null;
      cover_url: string | null;
      is_collapsed: boolean;
    }>
  ) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateCollection(): UseUpdateCollectionReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCollection = useCallback(
    async (
      collectionId: string,
      updates: Partial<{
        name: string;
        description: string | null;
        icon_url: string | null;
        icon_emoji: string | null;
        cover_url: string | null;
        is_collapsed: boolean;
      }>
    ): Promise<boolean> => {
      try {
        setUpdating(true);
        setError(null);

        const { error: updateError } = await supabase
          .from("collections")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", collectionId);

        if (updateError) throw updateError;

        return true;
      } catch (err: any) {
        console.error("[useUpdateCollection] Error:", err?.message || err);
        setError(err?.message || "Failed to update collection");
        return false;
      } finally {
        setUpdating(false);
      }
    },
    []
  );

  return { updateCollection, updating, error };
}

// ============================================================================
// useUpdateCollectionItem - Update collection item details
// ============================================================================

interface UseUpdateCollectionItemReturn {
  updateItem: (
    itemId: string,
    updates: Partial<{
      name: string;
      description: string | null;
      cover_url: string | null;
      icon_emoji: string | null;
      metadata: CollectionItemMetadata;
    }>
  ) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateCollectionItem(): UseUpdateCollectionItemReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = useCallback(
    async (
      itemId: string,
      updates: Partial<{
        name: string;
        description: string | null;
        cover_url: string | null;
        icon_emoji: string | null;
        metadata: CollectionItemMetadata;
      }>
    ): Promise<boolean> => {
      try {
        setUpdating(true);
        setError(null);

        const { error: updateError } = await supabase
          .from("collection_items")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        if (updateError) throw updateError;

        return true;
      } catch (err: any) {
        console.error("[useUpdateCollectionItem] Error:", err?.message || err);
        setError(err?.message || "Failed to update collection item");
        return false;
      } finally {
        setUpdating(false);
      }
    },
    []
  );

  return { updateItem, updating, error };
}

// ============================================================================
// useDeleteCollection - Delete a collection
// ============================================================================

interface UseDeleteCollectionReturn {
  deleteCollection: (collectionId: string) => Promise<boolean>;
  deleting: boolean;
  error: string | null;
}

export function useDeleteCollection(): UseDeleteCollectionReturn {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteCollection = useCallback(async (collectionId: string): Promise<boolean> => {
    try {
      setDeleting(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err: any) {
      console.error("[useDeleteCollection] Error:", err?.message || err);
      setError(err?.message || "Failed to delete collection");
      return false;
    } finally {
      setDeleting(false);
    }
  }, []);

  return { deleteCollection, deleting, error };
}

// ============================================================================
// useDeleteCollectionItem - Delete a collection item
// ============================================================================

interface UseDeleteCollectionItemReturn {
  deleteItem: (itemId: string) => Promise<boolean>;
  deleting: boolean;
  error: string | null;
}

export function useDeleteCollectionItem(): UseDeleteCollectionItemReturn {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      setDeleting(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from("collection_items")
        .delete()
        .eq("id", itemId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err: any) {
      console.error("[useDeleteCollectionItem] Error:", err?.message || err);
      setError(err?.message || "Failed to delete collection item");
      return false;
    } finally {
      setDeleting(false);
    }
  }, []);

  return { deleteItem, deleting, error };
}

// ============================================================================
// useReorderCollections - Reorder collections
// ============================================================================

interface UseReorderCollectionsReturn {
  reorderCollections: (collectionIds: string[]) => Promise<boolean>;
  reordering: boolean;
  error: string | null;
}

export function useReorderCollections(): UseReorderCollectionsReturn {
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorderCollections = useCallback(async (collectionIds: string[]): Promise<boolean> => {
    try {
      setReordering(true);
      setError(null);

      // Update positions for all collections
      const updates = collectionIds.map((id, index) =>
        supabase
          .from("collections")
          .update({ position: index, updated_at: new Date().toISOString() })
          .eq("id", id)
      );

      await Promise.all(updates);

      return true;
    } catch (err: any) {
      console.error("[useReorderCollections] Error:", err?.message || err);
      setError(err?.message || "Failed to reorder collections");
      return false;
    } finally {
      setReordering(false);
    }
  }, []);

  return { reorderCollections, reordering, error };
}

// ============================================================================
// useReorderCollectionItems - Reorder items within a collection
// ============================================================================

interface UseReorderCollectionItemsReturn {
  reorderItems: (itemIds: string[]) => Promise<boolean>;
  reordering: boolean;
  error: string | null;
}

export function useReorderCollectionItems(): UseReorderCollectionItemsReturn {
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorderItems = useCallback(async (itemIds: string[]): Promise<boolean> => {
    try {
      setReordering(true);
      setError(null);

      // Update positions for all items
      const updates = itemIds.map((id, index) =>
        supabase
          .from("collection_items")
          .update({ position: index, updated_at: new Date().toISOString() })
          .eq("id", id)
      );

      await Promise.all(updates);

      return true;
    } catch (err: any) {
      console.error("[useReorderCollectionItems] Error:", err?.message || err);
      setError(err?.message || "Failed to reorder items");
      return false;
    } finally {
      setReordering(false);
    }
  }, []);

  return { reorderItems, reordering, error };
}

// ============================================================================
// useToggleCollectionCollapse - Toggle collection collapsed state
// ============================================================================

export function useToggleCollectionCollapse() {
  const { updateCollection } = useUpdateCollection();

  const toggleCollapse = useCallback(
    async (collectionId: string, isCollapsed: boolean): Promise<boolean> => {
      return updateCollection(collectionId, { is_collapsed: !isCollapsed });
    },
    [updateCollection]
  );

  return { toggleCollapse };
}
