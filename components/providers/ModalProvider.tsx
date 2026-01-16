"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import PostDetailModal from "@/components/feed/PostDetailModal";
import TakeDetailModal, { TakeUpdate } from "@/components/takes/TakeDetailModal";
import { Take, TakeReactionType } from "@/lib/hooks/useTakes";
import { PostStyling, JournalMetadata } from "@/lib/types";

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorUser {
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Post {
  id: string;
  authorId?: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  type: "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "screenplay" | "story" | "letter" | "quote";
  typeLabel: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media?: MediaItem[];
  image?: string;
  stats: {
    admires: number;
    comments: number;
    relays: number;
  };
  isAdmired?: boolean;
  isSaved?: boolean;
  isRelayed?: boolean;
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
  // Creative styling
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
}

export interface PostUpdate {
  postId: string;
  field: "admires" | "comments" | "relays" | "saves" | "reactions";
  isActive: boolean;
  countChange: number;
  reactionType?: string | null;
}

type PostUpdateCallback = (update: PostUpdate) => void;

type PostDeleteCallback = (postId: string) => void;

type TakeUpdateCallback = (update: TakeUpdate) => void;

type TakeDeleteCallback = (takeId: string) => void;

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
}

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
  const [subscribers, setSubscribers] = useState<PostUpdateCallback[]>([]);
  const [deleteSubscribers, setDeleteSubscribers] = useState<PostDeleteCallback[]>([]);
  const originalUrlRef = useRef<string | null>(null);

  // Take modal state
  const [selectedTake, setSelectedTake] = useState<Take | null>(null);
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const [takeSubscribers, setTakeSubscribers] = useState<TakeUpdateCallback[]>([]);
  const [takeDeleteSubscribers, setTakeDeleteSubscribers] = useState<TakeDeleteCallback[]>([]);
  const takeOriginalUrlRef = useRef<string | null>(null);

  const openPostModal = (post: Post) => {
    // Store the original URL before changing
    originalUrlRef.current = window.location.pathname + window.location.search;

    // Update URL to post page without navigation
    window.history.pushState({ postId: post.id }, '', `/post/${post.id}`);

    setSelectedPost(post);
    setIsModalOpen(true);
  };

  const closePostModal = () => {
    // Restore the original URL
    if (originalUrlRef.current) {
      window.history.pushState({}, '', originalUrlRef.current);
      originalUrlRef.current = null;
    }

    setIsModalOpen(false);
    setTimeout(() => setSelectedPost(null), 300);
  };

  const openTakeModal = (take: Take) => {
    // Store the original URL before changing
    takeOriginalUrlRef.current = window.location.pathname + window.location.search;

    // Update URL to take page without navigation
    window.history.pushState({ takeId: take.id }, '', `/take/${take.id}`);

    setSelectedTake(take);
    setIsTakeModalOpen(true);
  };

  const closeTakeModal = () => {
    // Restore the original URL
    if (takeOriginalUrlRef.current) {
      window.history.pushState({}, '', takeOriginalUrlRef.current);
      takeOriginalUrlRef.current = null;
    }

    setIsTakeModalOpen(false);
    setTimeout(() => setSelectedTake(null), 300);
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (isModalOpen) {
        setIsModalOpen(false);
        setTimeout(() => setSelectedPost(null), 300);
        originalUrlRef.current = null;
      }
      if (isTakeModalOpen) {
        setIsTakeModalOpen(false);
        setTimeout(() => setSelectedTake(null), 300);
        takeOriginalUrlRef.current = null;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isModalOpen, isTakeModalOpen]);

  const subscribeToUpdates = useCallback((callback: PostUpdateCallback) => {
    setSubscribers((prev) => [...prev, callback]);
    return () => {
      setSubscribers((prev) => prev.filter((cb) => cb !== callback));
    };
  }, []);

  const notifyUpdate = useCallback((update: PostUpdate) => {
    subscribers.forEach((callback) => callback(update));
    // Also update the selected post if it matches
    if (selectedPost && selectedPost.id === update.postId) {
      setSelectedPost((prev) => {
        if (!prev) return prev;
        const newStats = { ...prev.stats };
        if (update.field === "admires") {
          newStats.admires = Math.max(0, newStats.admires + update.countChange);
          return { ...prev, stats: newStats, isAdmired: update.isActive };
        }
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
  }, [subscribers, selectedPost]);

  const subscribeToDeletes = useCallback((callback: PostDeleteCallback) => {
    setDeleteSubscribers((prev) => [...prev, callback]);
    return () => {
      setDeleteSubscribers((prev) => prev.filter((cb) => cb !== callback));
    };
  }, []);

  const notifyDelete = useCallback((postId: string) => {
    deleteSubscribers.forEach((callback) => callback(postId));
  }, [deleteSubscribers]);

  const handlePostDeleted = useCallback((postId: string) => {
    notifyDelete(postId);
  }, [notifyDelete]);

  // Take update subscriptions
  const subscribeToTakeUpdates = useCallback((callback: TakeUpdateCallback) => {
    setTakeSubscribers((prev) => [...prev, callback]);
    return () => {
      setTakeSubscribers((prev) => prev.filter((cb) => cb !== callback));
    };
  }, []);

  const notifyTakeUpdate = useCallback((update: TakeUpdate) => {
    takeSubscribers.forEach((callback) => callback(update));
    // Also update the selected take if it matches
    if (selectedTake && selectedTake.id === update.takeId) {
      setSelectedTake((prev) => {
        if (!prev) return prev;
        if (update.field === "reactions") {
          return {
            ...prev,
            reactions_count: Math.max(0, prev.reactions_count + update.countChange),
            user_reaction_type: update.reactionType as typeof prev.user_reaction_type,
            is_admired: update.isActive,
          };
        }
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
  }, [takeSubscribers, selectedTake]);

  const subscribeToTakeDeletes = useCallback((callback: TakeDeleteCallback) => {
    setTakeDeleteSubscribers((prev) => [...prev, callback]);
    return () => {
      setTakeDeleteSubscribers((prev) => prev.filter((cb) => cb !== callback));
    };
  }, []);

  const notifyTakeDelete = useCallback((takeId: string) => {
    takeDeleteSubscribers.forEach((callback) => callback(takeId));
  }, [takeDeleteSubscribers]);

  const handleTakeDeleted = useCallback((takeId: string) => {
    notifyTakeDelete(takeId);
  }, [notifyTakeDelete]);

  return (
    <ModalContext.Provider value={{
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
    }}>
      {children}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          isOpen={isModalOpen}
          onClose={closePostModal}
          onPostUpdate={notifyUpdate}
          onPostDeleted={handlePostDeleted}
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