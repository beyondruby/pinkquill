"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from "react";
import dynamic from "next/dynamic";
import Loading from "@/components/ui/Loading";
import type { TakeUpdate } from "@/components/takes/TakeDetailModal";
import { Take } from "@/lib/hooks/useTakes";
import type { ModalPost } from "@/components/feed/PostCard/types";

type Post = ModalPost;

// Reactions no longer travel on this bus: every surface reads
// lib/engagement/store.ts directly (Phase 1).
export interface PostUpdate {
  postId: string;
  field: "comments" | "relays" | "saves";
  isActive: boolean;
  countChange: number;
}

type PostUpdateCallback = (update: PostUpdate) => void;

type PostDeleteCallback = (postId: string) => void;

type TakeUpdateCallback = (update: TakeUpdate) => void;

type TakeDeleteCallback = (takeId: string) => void;

// Moderation context for community comment deletion
interface ModerationContext {
  canModerateDeleteComments: boolean;
  onModeratorDeleteComment?: (commentId: string, reason?: string) => Promise<void>;
}

interface ModalContextType {
  openPostModal: (post: Post) => void;
  closePostModal: () => void;
  subscribeToUpdates: (callback: PostUpdateCallback) => () => void;
  notifyUpdate: (update: PostUpdate) => void;
  subscribeToDeletes: (callback: PostDeleteCallback) => () => void;
  notifyDelete: (postId: string) => void;
  // Take modal methods
  openTakeModal: (take: Take) => void;
  closeTakeModal: () => void;
  subscribeToTakeUpdates: (callback: TakeUpdateCallback) => () => void;
  notifyTakeUpdate: (update: TakeUpdate) => void;
  subscribeToTakeDeletes: (callback: TakeDeleteCallback) => () => void;
  notifyTakeDelete: (takeId: string) => void;
  // Moderation context methods
  setModerationContext: (context: ModerationContext | null) => void;
  /** The URL underneath an open modal (null when none is open). */
  modalReturnPath: string | null;
}

// The two detail modals are ~2,000 lines together and only needed once a user
// opens a post or a take, so they load on first open instead of in the root
// chunk of every page.
// While the chunk downloads on first open the URL has already changed, so
// show the same backdrop the modal will use instead of nothing (V-46).
function ModalChunkLoading() {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Loading text="Opening" />
    </div>
  );
}
const PostDetailModal = dynamic(() => import("@/components/feed/PostDetailModal"), { ssr: false, loading: ModalChunkLoading });
const TakeDetailModal = dynamic(() => import("@/components/takes/TakeDetailModal"), { ssr: false, loading: ModalChunkLoading });

/**
 * What we stamp on the one history entry a modal pushes. `pqReturn` is the
 * URL under the modal, so chrome that keys on the pathname (right sidebar,
 * bottom nav) can keep treating the page as the feed while it is open.
 */
interface ModalHistoryState {
  pqModal?: "post" | "take";
  pqId?: string;
  pqReturn?: string;
}
const readHistoryState = (): ModalHistoryState =>
  (typeof window !== "undefined" && window.history.state ? window.history.state : {}) as ModalHistoryState;

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  // Post modal state
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const subscribersRef = useRef<Set<PostUpdateCallback>>(new Set());
  const deleteSubscribersRef = useRef<Set<PostDeleteCallback>>(new Set());
  const originalUrlRef = useRef<string | null>(null);

  // Take modal state
  const [selectedTake, setSelectedTake] = useState<Take | null>(null);
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const takeSubscribersRef = useRef<Set<TakeUpdateCallback>>(new Set());
  const takeDeleteSubscribersRef = useRef<Set<TakeDeleteCallback>>(new Set());
  const takeOriginalUrlRef = useRef<string | null>(null);

  // Moderation context state
  const [moderationContext, setModerationContext] = useState<ModerationContext | null>(null);

  // The URL under the open modal; lets pathname-driven chrome stay put (V-8).
  const [modalReturnPath, setModalReturnPath] = useState<string | null>(null);
  // Last item shown, so a Forward into our entry can reopen it.
  const lastPostRef = useRef<Post | null>(null);
  const lastTakeRef = useRef<Take | null>(null);

  /**
   * History contract (V-6 / V-7 / F-6): opening a modal pushes exactly ONE
   * entry, stamped with `pqModal`; opening another while one is open swaps
   * that entry in place; closing pops it with `history.back()`; Back while
   * open closes it. Nothing is ever pushed on close, so the stack behind the
   * feed stays as it was.
   */
  const openPostModal = useCallback((post: Post) => {
    const state = readHistoryState();
    const url = `/post/${post.id}`;
    if (state.pqModal) {
      window.history.replaceState({ ...state, pqModal: "post", pqId: post.id }, "", url);
    } else {
      const returnTo = window.location.pathname + window.location.search;
      originalUrlRef.current = returnTo;
      window.history.pushState({ ...state, pqModal: "post", pqId: post.id, pqReturn: returnTo }, "", url);
    }
    lastPostRef.current = post;
    setSelectedTake(null);
    setIsTakeModalOpen(false);
    setSelectedPost(post);
    setIsModalOpen(true);
    setModalReturnPath(readHistoryState().pqReturn ?? originalUrlRef.current);
  }, []);

  const closePostModal = useCallback(() => {
    const state = readHistoryState();
    setIsModalOpen(false);
    setSelectedPost(null);
    setModalReturnPath(null);
    if (state.pqModal === "post") {
      // We own the current entry: pop it instead of pushing another.
      window.history.back();
    } else if (originalUrlRef.current) {
      // Nothing of ours to pop (state lost after a reload): restore in place.
      window.history.replaceState({ ...state }, "", originalUrlRef.current);
    }
    originalUrlRef.current = null;
  }, []);

  const openTakeModal = useCallback((take: Take) => {
    const state = readHistoryState();
    const url = `/take/${take.id}`;
    if (state.pqModal) {
      window.history.replaceState({ ...state, pqModal: "take", pqId: take.id }, "", url);
    } else {
      const returnTo = window.location.pathname + window.location.search;
      takeOriginalUrlRef.current = returnTo;
      window.history.pushState({ ...state, pqModal: "take", pqId: take.id, pqReturn: returnTo }, "", url);
    }
    lastTakeRef.current = take;
    setSelectedPost(null);
    setIsModalOpen(false);
    setSelectedTake(take);
    setIsTakeModalOpen(true);
    setModalReturnPath(readHistoryState().pqReturn ?? takeOriginalUrlRef.current);
  }, []);

  const closeTakeModal = useCallback(() => {
    const state = readHistoryState();
    setIsTakeModalOpen(false);
    setSelectedTake(null);
    setModalReturnPath(null);
    if (state.pqModal === "take") {
      window.history.back();
    } else if (takeOriginalUrlRef.current) {
      window.history.replaceState({ ...state }, "", takeOriginalUrlRef.current);
    }
    takeOriginalUrlRef.current = null;
  }, []);

  // Browser Back / Forward. Back out of our entry closes the modal; Forward
  // into it reopens the last item we showed.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = (event.state ?? {}) as ModalHistoryState;
      if (state.pqModal === "post" && lastPostRef.current && state.pqId === lastPostRef.current.id) {
        setSelectedTake(null);
        setIsTakeModalOpen(false);
        setSelectedPost(lastPostRef.current);
        setIsModalOpen(true);
        setModalReturnPath(state.pqReturn ?? null);
        return;
      }
      if (state.pqModal === "take" && lastTakeRef.current && state.pqId === lastTakeRef.current.id) {
        setSelectedPost(null);
        setIsModalOpen(false);
        setSelectedTake(lastTakeRef.current);
        setIsTakeModalOpen(true);
        setModalReturnPath(state.pqReturn ?? null);
        return;
      }
      if (!state.pqModal) {
        setIsModalOpen(false);
        setSelectedPost(null);
        originalUrlRef.current = null;
        setIsTakeModalOpen(false);
        setSelectedTake(null);
        takeOriginalUrlRef.current = null;
        setModalReturnPath(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const subscribeToUpdates = useCallback((callback: PostUpdateCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Stable: subscribers live in a ref and the selected post is read through
  // the functional updater, so consumers' effects don't re-run per update.
  const notifyUpdate = useCallback((update: PostUpdate) => {
    for (const callback of Array.from(subscribersRef.current)) callback(update);
    // Also update the selected post if it matches
    {
      setSelectedPost((prev) => {
        if (!prev || prev.id !== update.postId) return prev;
        const newStats = { ...prev.stats };
        if (update.field === "relays") {
          newStats.relays = Math.max(0, newStats.relays + update.countChange);
          return { ...prev, stats: newStats, isRelayed: update.isActive };
        }
        if (update.field === "saves") {
          return { ...prev, isSaved: update.isActive };
        }
        if (update.field === "comments") {
          newStats.comments = Math.max(0, newStats.comments + update.countChange);
          return { ...prev, stats: newStats };
        }
        return prev;
      });
    }
  }, []);

  const subscribeToDeletes = useCallback((callback: PostDeleteCallback) => {
    deleteSubscribersRef.current.add(callback);
    return () => {
      deleteSubscribersRef.current.delete(callback);
    };
  }, []);

  const notifyDelete = useCallback((postId: string) => {
    for (const callback of Array.from(deleteSubscribersRef.current)) callback(postId);
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    notifyDelete(postId);
  }, [notifyDelete]);

  // Take update subscriptions
  const subscribeToTakeUpdates = useCallback((callback: TakeUpdateCallback) => {
    takeSubscribersRef.current.add(callback);
    return () => {
      takeSubscribersRef.current.delete(callback);
    };
  }, []);

  const notifyTakeUpdate = useCallback((update: TakeUpdate) => {
    for (const callback of Array.from(takeSubscribersRef.current)) callback(update);
    // Also update the selected take if it matches
    {
      setSelectedTake((prev) => {
        if (!prev || prev.id !== update.takeId) return prev;
        if (update.field === "relays") {
          return {
            ...prev,
            relays_count: Math.max(0, prev.relays_count + update.countChange),
            is_relayed: update.isActive,
          };
        }
        if (update.field === "saves") {
          return { ...prev, is_saved: update.isActive };
        }
        if (update.field === "comments") {
          return {
            ...prev,
            comments_count: Math.max(0, prev.comments_count + update.countChange),
          };
        }
        return prev;
      });
    }
  }, []);

  const subscribeToTakeDeletes = useCallback((callback: TakeDeleteCallback) => {
    takeDeleteSubscribersRef.current.add(callback);
    return () => {
      takeDeleteSubscribersRef.current.delete(callback);
    };
  }, []);

  const notifyTakeDelete = useCallback((takeId: string) => {
    for (const callback of Array.from(takeDeleteSubscribersRef.current)) callback(takeId);
  }, []);

  const handleTakeDeleted = useCallback((takeId: string) => {
    notifyTakeDelete(takeId);
  }, [notifyTakeDelete]);

  const contextValue = useMemo(() => ({
    openPostModal,
    closePostModal,
    subscribeToUpdates,
    notifyUpdate,
    subscribeToDeletes,
    notifyDelete,
    openTakeModal,
    closeTakeModal,
    subscribeToTakeUpdates,
    notifyTakeUpdate,
    subscribeToTakeDeletes,
    notifyTakeDelete,
    setModerationContext,
    modalReturnPath,
  }), [
    openPostModal,
    closePostModal,
    subscribeToUpdates,
    notifyUpdate,
    subscribeToDeletes,
    notifyDelete,
    openTakeModal,
    closeTakeModal,
    subscribeToTakeUpdates,
    notifyTakeUpdate,
    subscribeToTakeDeletes,
    notifyTakeDelete,
    setModerationContext,
    modalReturnPath,
  ]);

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          isOpen={isModalOpen}
          onClose={closePostModal}
          onPostUpdate={notifyUpdate}
          onPostDeleted={handlePostDeleted}
          canModerateDeleteComments={moderationContext?.canModerateDeleteComments}
          onModeratorDeleteComment={moderationContext?.onModeratorDeleteComment}
        />
      )}
      {selectedTake && (
        <TakeDetailModal
          take={selectedTake}
          isOpen={isTakeModalOpen}
          onClose={closeTakeModal}
          onTakeUpdate={notifyTakeUpdate}
          onTakeDeleted={handleTakeDeleted}
        />
      )}
    </ModalContext.Provider>
  );
}