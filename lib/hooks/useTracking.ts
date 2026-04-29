"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

// ============================================================================
// SESSION ID MANAGEMENT
// ============================================================================

const SESSION_ID_KEY = "quill_session_id";
const RELATIONSHIP_CACHE_TTL_MS = 2 * 60 * 1000;

interface BooleanCacheEntry {
  value: boolean;
  fetchedAt: number;
}

const blockedRelationshipCache = new Map<string, BooleanCacheEntry>();
const followRelationshipCache = new Map<string, BooleanCacheEntry>();

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

interface PostImpressionInsertRow {
  post_id: string;
  viewer_id: string | null;
  session_id: string | null;
  source: string;
}

const POST_IMPRESSION_BATCH_WINDOW_MS = 750;
const POST_IMPRESSION_BATCH_SIZE = 30;
const POST_IMPRESSION_RETRY_DELAY_MS = 2500;

let queuedPostImpressions: PostImpressionInsertRow[] = [];
let postImpressionFlushTimer: number | null = null;
let postImpressionFlushInFlight: Promise<void> | null = null;
let postImpressionFlushListenersBound = false;

function getCachedBoolean(
  cache: Map<string, BooleanCacheEntry>,
  key: string
): boolean | undefined {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (Date.now() - cached.fetchedAt >= RELATIONSHIP_CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return cached.value;
}

function setCachedBoolean(
  cache: Map<string, BooleanCacheEntry>,
  key: string,
  value: boolean
) {
  cache.set(key, { value, fetchedAt: Date.now() });
}

function runWhenIdle(task: () => void, timeout: number = 1200): () => void {
  if (typeof window === "undefined") {
    task();
    return () => undefined;
  }

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => task(), { timeout });
    return () => {
      if (typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(handle);
      }
    };
  }

  const timer = window.setTimeout(task, 0);
  return () => window.clearTimeout(timer);
}

function schedulePostImpressionFlush(delayMs: number = POST_IMPRESSION_BATCH_WINDOW_MS) {
  if (typeof window === "undefined") {
    void flushPostImpressions();
    return;
  }

  if (postImpressionFlushTimer !== null) return;
  postImpressionFlushTimer = window.setTimeout(() => {
    postImpressionFlushTimer = null;
    void flushPostImpressions();
  }, delayMs);
}

async function flushPostImpressions() {
  if (postImpressionFlushInFlight) return;
  if (queuedPostImpressions.length === 0) return;

  const batch = queuedPostImpressions.splice(0, POST_IMPRESSION_BATCH_SIZE);

  postImpressionFlushInFlight = (async () => {
    const { error } = await supabase.from("post_impressions").insert(batch);

    if (error) {
      queuedPostImpressions = batch.concat(queuedPostImpressions);
      console.warn("[tracking] post impression batch insert failed:", error.message);
      schedulePostImpressionFlush(POST_IMPRESSION_RETRY_DELAY_MS);
    }
  })();

  try {
    await postImpressionFlushInFlight;
  } finally {
    postImpressionFlushInFlight = null;
  }

  if (queuedPostImpressions.length > 0) {
    if (queuedPostImpressions.length >= POST_IMPRESSION_BATCH_SIZE) {
      void flushPostImpressions();
      return;
    }
    schedulePostImpressionFlush();
  }
}

function enqueuePostImpression(row: PostImpressionInsertRow) {
  queuedPostImpressions.push(row);
  if (queuedPostImpressions.length >= POST_IMPRESSION_BATCH_SIZE) {
    void flushPostImpressions();
    return;
  }
  schedulePostImpressionFlush();
}

function ensurePostImpressionFlushListeners() {
  if (postImpressionFlushListenersBound || typeof window === "undefined") return;
  postImpressionFlushListenersBound = true;

  const flush = () => {
    void flushPostImpressions();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });
  window.addEventListener("pagehide", flush);
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

// ============================================================================
// BLOCKED USER CHECK
// ============================================================================

async function isBlockedEitherWay(
  userId1: string | null,
  userId2: string
): Promise<boolean> {
  if (!userId1) return false;
  if (userId1 === userId2) return false;

  const cacheKey = [userId1, userId2].sort().join(":");
  const cached = getCachedBoolean(blockedRelationshipCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    // Check both directions separately to avoid SQL injection from string interpolation
    const [{ data: block1, error: error1 }, { data: block2, error: error2 }] = await Promise.all([
      supabase
        .from("blocks")
        .select("id")
        .eq("blocker_id", userId1)
        .eq("blocked_id", userId2)
        .maybeSingle(),
      supabase
        .from("blocks")
        .select("id")
        .eq("blocker_id", userId2)
        .eq("blocked_id", userId1)
        .maybeSingle(),
    ]);

    if (error1 || error2) {
      throw error1 || error2;
    }

    const blocked = !!(block1 || block2);
    setCachedBoolean(blockedRelationshipCache, cacheKey, blocked);
    return blocked;
  } catch (err) {
    console.warn("[tracking] block lookup failed:", err);
    return false;
  }
}

// ============================================================================
// FOLLOWER CHECK
// ============================================================================

async function checkIsFollowing(
  followerId: string | null,
  followingId: string
): Promise<boolean> {
  if (!followerId || followerId === followingId) return false;

  const cacheKey = `${followerId}->${followingId}`;
  const cached = getCachedBoolean(followRelationshipCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const isFollowing = !!data;
    setCachedBoolean(followRelationshipCache, cacheKey, isFollowing);
    return isFollowing;
  } catch (err) {
    console.warn("[tracking] follow lookup failed:", err);
    return false;
  }
}

// ============================================================================
// POST TRACKING
// ============================================================================

/**
 * Track post impression (call immediately when post renders)
 * Records every display, including repeats
 */
export function useTrackPostImpression(
  postId: string | undefined,
  source: string = "feed"
) {
  const { user } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!postId || tracked.current) return;
    tracked.current = true;

    const queueImpression = () => {
      const sessionId = getSessionId();
      enqueuePostImpression({
        post_id: postId,
        viewer_id: user?.id || null,
        session_id: user?.id ? null : sessionId,
        source,
      });
    };

    ensurePostImpressionFlushListeners();
    const cancelIdle = runWhenIdle(() => {
      queueImpression();
    });

    return () => {
      cancelIdle();
    };
  }, [postId, user?.id, source]);
}

/**
 * Track post view (records unique view after 1 second visibility)
 * Uses IntersectionObserver to detect when post is visible
 */
export function useTrackPostView(
  postId: string | undefined,
  authorId: string | undefined,
  source: string = "feed"
) {
  const { user } = useAuth();
  const viewRecorded = useRef(false);
  const visibilityTimer = useRef<NodeJS.Timeout | null>(null);
  const readStartTime = useRef<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const recordView = useCallback(async () => {
    if (!postId || !authorId || viewRecorded.current) return;

    // Check if blocked
    const blocked = await isBlockedEitherWay(user?.id || null, authorId);
    if (blocked) return;

    viewRecorded.current = true;
    const sessionId = getSessionId();
    const isFollower = user?.id
      ? await checkIsFollowing(user.id, authorId)
      : false;

    await supabase.from("post_views").upsert(
      {
        post_id: postId,
        viewer_id: user?.id || null,
        session_id: user?.id ? null : sessionId,
        source,
        is_follower: isFollower,
        read_time_seconds: 0,
      },
      {
        onConflict: user?.id ? "post_id,viewer_id,view_date" : "post_id,session_id,view_date",
        ignoreDuplicates: true,
      }
    );
  }, [postId, authorId, user?.id, source]);

  const updateReadTime = useCallback(async () => {
    if (!postId || !readStartTime.current) return;

    const readTime = Math.floor((Date.now() - readStartTime.current) / 1000);
    if (readTime < 1) return;

    const sessionId = getSessionId();

    await supabase
      .from("post_views")
      .update({ read_time_seconds: readTime })
      .eq("post_id", postId)
      .eq(user?.id ? "viewer_id" : "session_id", user?.id || sessionId)
      .eq("view_date", new Date().toISOString().split("T")[0]);
  }, [postId, user?.id]);

  const startTracking = useCallback(
    (element: HTMLElement) => {
      elementRef.current = element;
      readStartTime.current = Date.now();

      // Record view after 1 second of visibility
      visibilityTimer.current = setTimeout(() => {
        recordView();
      }, 1000);
    },
    [recordView]
  );

  const stopTracking = useCallback(() => {
    if (visibilityTimer.current) {
      clearTimeout(visibilityTimer.current);
      visibilityTimer.current = null;
    }
    updateReadTime();
    readStartTime.current = null;
  }, [updateReadTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (visibilityTimer.current) {
        clearTimeout(visibilityTimer.current);
      }
      if (readStartTime.current && viewRecorded.current) {
        updateReadTime();
      }
    };
  }, [updateReadTime]);

  return { startTracking, stopTracking, ref: elementRef };
}

/**
 * Hook that combines view tracking with IntersectionObserver
 * Auto-tracks when element enters/exits viewport
 */
export function usePostViewTracker(
  postId: string | undefined,
  authorId: string | undefined,
  source: string = "feed"
) {
  const { startTracking, stopTracking } = useTrackPostView(
    postId,
    authorId,
    source
  );
  const elementRef = useRef<HTMLDivElement>(null);
  const isVisible = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !postId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible.current) {
            isVisible.current = true;
            startTracking(element);
          } else if (!entry.isIntersecting && isVisible.current) {
            isVisible.current = false;
            stopTracking();
          }
        });
      },
      { threshold: 0.5 } // 50% visible
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (isVisible.current) {
        stopTracking();
      }
    };
  }, [postId, startTracking, stopTracking]);

  return elementRef;
}

// ============================================================================
// TAKE TRACKING
// ============================================================================

/**
 * Track take impression (call immediately when take renders)
 */
export function useTrackTakeImpression(
  takeId: string | undefined,
  source: string = "feed",
  enabled: boolean = true
) {
  const { user } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!enabled || !takeId || tracked.current) return;
    tracked.current = true;

    const recordImpression = async () => {
      const sessionId = getSessionId();

      const { error } = await supabase.from("take_impressions").insert({
        take_id: takeId,
        viewer_id: user?.id || null,
        session_id: user?.id ? null : sessionId,
        source,
      });

      if (error) {
        console.warn("[tracking] take impression insert failed:", error.message);
      }
    };

    const cancelIdle = runWhenIdle(() => {
      void recordImpression();
    });

    return () => {
      cancelIdle();
    };
  }, [enabled, takeId, user?.id, source]);
}

/**
 * Track take view with watch metrics
 * Returns functions to track play, pause, loop, and completion events
 */
export function useTrackTakeView(
  takeId: string | undefined,
  authorId: string | undefined,
  takeDurationSeconds: number = 0,
  source: string = "feed"
) {
  const { user } = useAuth();
  const viewRecorded = useRef(false);
  const watchStartTime = useRef<number | null>(null);
  const totalWatchTime = useRef(0);
  const loopCount = useRef(0);
  const hasCompleted = useRef(false);
  const isWatching = useRef(false);
  const viewTimer = useRef<number | null>(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const recordView = useCallback(async () => {
    if (!takeId || !authorId || viewRecorded.current) return;

    // Check if blocked
    const blocked = await isBlockedEitherWay(user?.id || null, authorId);
    if (blocked) return;

    viewRecorded.current = true;
    const sessionId = getSessionId();
    const isFollower = user?.id
      ? await checkIsFollowing(user.id, authorId)
      : false;

    await supabase.from("take_views").upsert(
      {
        take_id: takeId,
        viewer_id: user?.id || null,
        session_id: user?.id ? null : sessionId,
        source,
        is_follower: isFollower,
        watch_time_seconds: 0,
        watch_percentage: 0,
        loop_count: 1,
        completed: false,
      },
      {
        onConflict: user?.id ? "take_id,viewer_id,view_date" : "take_id,session_id,view_date",
        ignoreDuplicates: true,
      }
    );
  }, [takeId, authorId, user?.id, source]);

  const updateWatchMetrics = useCallback(async () => {
    if (!takeId) return;

    const sessionId = getSessionId();
    const watchPercentage =
      takeDurationSeconds > 0
        ? Math.min(
            100,
            Math.round((totalWatchTime.current / takeDurationSeconds) * 100)
          )
        : 0;

    await supabase
      .from("take_views")
      .update({
        watch_time_seconds: Math.floor(totalWatchTime.current),
        watch_percentage: watchPercentage,
        loop_count: Math.max(1, loopCount.current),
        completed: hasCompleted.current,
      })
      .eq("take_id", takeId)
      .eq(user?.id ? "viewer_id" : "session_id", user?.id || sessionId)
      .eq("view_date", new Date().toISOString().split("T")[0]);
  }, [takeId, user?.id, takeDurationSeconds]);

  const startWatching = useCallback(() => {
    if (isWatching.current) return;
    isWatching.current = true;
    watchStartTime.current = Date.now();

    // Record view after 3 seconds of watching
    if (typeof window === "undefined") {
      void recordView();
      return;
    }

    if (viewTimer.current !== null) {
      window.clearTimeout(viewTimer.current);
    }

    viewTimer.current = window.setTimeout(() => {
      if (isWatching.current) {
        void recordView();
      }
      viewTimer.current = null;
    }, 3000);
  }, [recordView]);

  const stopWatching = useCallback(() => {
    if (viewTimer.current !== null) {
      window.clearTimeout(viewTimer.current);
      viewTimer.current = null;
    }

    if (!isWatching.current || !watchStartTime.current) return;
    isWatching.current = false;

    const watchDuration = (Date.now() - watchStartTime.current) / 1000;
    totalWatchTime.current += watchDuration;
    watchStartTime.current = null;

    if (viewRecorded.current) {
      updateWatchMetrics();
    }
  }, [updateWatchMetrics]);

  const recordLoop = useCallback(() => {
    loopCount.current += 1;
    if (viewRecorded.current) {
      updateWatchMetrics();
    }
  }, [updateWatchMetrics]);

  const recordCompletion = useCallback(() => {
    if (!hasCompleted.current) {
      hasCompleted.current = true;
      if (viewRecorded.current) {
        updateWatchMetrics();
      }
    }
  }, [updateWatchMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewTimer.current !== null) {
        window.clearTimeout(viewTimer.current);
        viewTimer.current = null;
      }
      if (isWatching.current && watchStartTime.current) {
        const watchDuration = (Date.now() - watchStartTime.current) / 1000;
        totalWatchTime.current += watchDuration;
      }
      if (viewRecorded.current && totalWatchTime.current > 0) {
        updateWatchMetrics();
      }
    };
  }, [updateWatchMetrics]);

  return {
    startWatching,
    stopWatching,
    recordLoop,
    recordCompletion,
  };
}

// ============================================================================
// PROFILE TRACKING
// ============================================================================

/**
 * Track profile view (records unique view after 2 seconds on profile)
 */
export function useTrackProfileView(
  profileId: string | undefined,
  source: string = "direct"
) {
  const { user } = useAuth();
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!profileId || viewRecorded.current) return;
    // Don't track self-views
    if (user?.id === profileId) return;

    const timer = setTimeout(async () => {
      if (viewRecorded.current) return;

      // Check if blocked
      const blocked = await isBlockedEitherWay(user?.id || null, profileId);
      if (blocked) return;

      viewRecorded.current = true;
      const sessionId = getSessionId();
      const isFollower = user?.id
        ? await checkIsFollowing(user.id, profileId)
        : false;

      await supabase.from("profile_views").upsert(
        {
          profile_id: profileId,
          viewer_id: user?.id || null,
          session_id: user?.id ? null : sessionId,
          source,
          is_follower: isFollower,
        },
        {
          onConflict: user?.id ? "profile_id,viewer_id,view_date" : "profile_id,session_id,view_date",
          ignoreDuplicates: true,
        }
      );
    }, 2000);

    return () => clearTimeout(timer);
  }, [profileId, user?.id, source]);
}

// ============================================================================
// COMMUNITY TRACKING
// ============================================================================

/**
 * Track community view (records unique view after 2 seconds on community page)
 */
export function useTrackCommunityView(communityId: string | undefined) {
  const { user } = useAuth();
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!communityId || viewRecorded.current) return;

    const timer = setTimeout(async () => {
      if (viewRecorded.current) return;
      viewRecorded.current = true;

      const sessionId = getSessionId();

      // Check if user is a member
      let isMember = false;
      if (user?.id) {
        const { data } = await supabase
          .from("community_members")
          .select("user_id")
          .eq("community_id", communityId)
          .eq("user_id", user.id)
          .maybeSingle();
        isMember = !!data;
      }

      await supabase.from("community_views").upsert(
        {
          community_id: communityId,
          viewer_id: user?.id || null,
          session_id: user?.id ? null : sessionId,
          is_member: isMember,
        },
        {
          onConflict: user?.id ? "community_id,viewer_id,view_date" : "community_id,session_id,view_date",
          ignoreDuplicates: true,
        }
      );
    }, 2000);

    return () => clearTimeout(timer);
  }, [communityId, user?.id]);
}

// ============================================================================
// SOURCE DETECTION HELPER
// ============================================================================

/**
 * Get the source from URL search params
 * Use this to determine where the user came from
 */
export function getSourceFromUrl(): string {
  if (typeof window === "undefined") return "direct";

  const params = new URLSearchParams(window.location.search);
  const source = params.get("source");

  const validSources = [
    "feed",
    "search",
    "profile",
    "community",
    "direct",
    "relay",
    "post",
    "take",
  ];
  return validSources.includes(source || "") ? source! : "direct";
}
