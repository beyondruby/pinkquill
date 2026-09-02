"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

// ============================================================================
// SESSION ID MANAGEMENT
// ============================================================================

const SESSION_ID_KEY = "quill_session_id";
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

interface TakeImpressionInsertRow {
  take_id: string;
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

const TAKE_IMPRESSION_BATCH_WINDOW_MS = 750;
const TAKE_IMPRESSION_BATCH_SIZE = 30;
const TAKE_IMPRESSION_RETRY_DELAY_MS = 2500;

let queuedTakeImpressions: TakeImpressionInsertRow[] = [];
let takeImpressionFlushTimer: number | null = null;
let takeImpressionFlushInFlight: Promise<void> | null = null;
let takeImpressionFlushListenersBound = false;

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

function scheduleTakeImpressionFlush(delayMs: number = TAKE_IMPRESSION_BATCH_WINDOW_MS) {
  if (typeof window === "undefined") {
    void flushTakeImpressions();
    return;
  }

  if (takeImpressionFlushTimer !== null) return;
  takeImpressionFlushTimer = window.setTimeout(() => {
    takeImpressionFlushTimer = null;
    void flushTakeImpressions();
  }, delayMs);
}

async function flushTakeImpressions() {
  if (takeImpressionFlushInFlight) return;
  if (queuedTakeImpressions.length === 0) return;

  const batch = queuedTakeImpressions.splice(0, TAKE_IMPRESSION_BATCH_SIZE);

  takeImpressionFlushInFlight = (async () => {
    const { error } = await supabase.from("take_impressions").insert(batch);

    if (error) {
      queuedTakeImpressions = batch.concat(queuedTakeImpressions);
      console.warn("[tracking] take impression batch insert failed:", error.message);
      scheduleTakeImpressionFlush(TAKE_IMPRESSION_RETRY_DELAY_MS);
    }
  })();

  try {
    await takeImpressionFlushInFlight;
  } finally {
    takeImpressionFlushInFlight = null;
  }

  if (queuedTakeImpressions.length > 0) {
    if (queuedTakeImpressions.length >= TAKE_IMPRESSION_BATCH_SIZE) {
      void flushTakeImpressions();
      return;
    }
    scheduleTakeImpressionFlush();
  }
}

function enqueueTakeImpression(row: TakeImpressionInsertRow) {
  queuedTakeImpressions.push(row);
  if (queuedTakeImpressions.length >= TAKE_IMPRESSION_BATCH_SIZE) {
    void flushTakeImpressions();
    return;
  }
  scheduleTakeImpressionFlush();
}

function ensureTakeImpressionFlushListeners() {
  if (takeImpressionFlushListenersBound || typeof window === "undefined") return;
  takeImpressionFlushListenersBound = true;

  const flush = () => {
    void flushTakeImpressions();
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
// VIEW WRITES — single RPC per write (Phase 4)
//
// The server derives viewer_id from auth.uid(), skips self-views and blocked
// pairs, computes is_follower / is_member, and owns the conflict targets.
// The client sends only the target id, the anonymous session id and the
// source. This replaced 2x blocks + 1x follows lookups per viewed item.
// ============================================================================

type ViewKind = "post" | "take" | "community" | "profile";

async function recordContentView(kind: ViewKind, targetId: string, source: string, isAnonymous: boolean) {
  const { error } = await supabase.rpc("record_content_view", {
    p_kind: kind,
    p_target_id: targetId,
    p_session_id: isAnonymous ? getSessionId() : null,
    p_source: source,
  });
  if (error) {
    console.warn(`[tracking] record ${kind} view failed:`, error.message);
  }
}

async function updateContentView(
  kind: "post" | "take",
  targetId: string,
  metrics: Record<string, number | boolean>,
  isAnonymous: boolean
) {
  const { error } = await supabase.rpc("update_content_view", {
    p_kind: kind,
    p_target_id: targetId,
    p_session_id: isAnonymous ? getSessionId() : null,
    p_metrics: metrics,
  });
  if (error) {
    console.warn(`[tracking] update ${kind} view failed:`, error.message);
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
  const { user, loading: authLoading } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    // Wait for auth to settle; otherwise a signed-in user's first impressions
    // were queued as anonymous and never re-attributed.
    if (!postId || tracked.current || authLoading) return;
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
  }, [postId, user?.id, authLoading, source]);
}

/**
 * Track post view (records unique view after 1 second visibility)
 * Uses IntersectionObserver to detect when post is visible
 */
export function useTrackPostView(postId: string | undefined, source: string = "feed") {
  const { user } = useAuth();
  const viewRecorded = useRef(false);
  const visibilityTimer = useRef<NodeJS.Timeout | null>(null);
  const readStartTime = useRef<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  // `authorId` is kept in the signature for callers; the server resolves the
  // author, self-view and block rules itself.
  const isAnonymous = !user?.id;

  const recordView = useCallback(async () => {
    if (!postId || viewRecorded.current) return;
    viewRecorded.current = true;
    await recordContentView("post", postId, source, isAnonymous);
  }, [postId, source, isAnonymous]);

  const updateReadTime = useCallback(async () => {
    if (!postId || !readStartTime.current || !viewRecorded.current) return;

    const readTime = Math.floor((Date.now() - readStartTime.current) / 1000);
    if (readTime < 1) return;

    await updateContentView("post", postId, { read_time_seconds: readTime }, isAnonymous);
  }, [postId, isAnonymous]);

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
export function usePostViewTracker(postId: string | undefined, source: string = "feed") {
  const { startTracking, stopTracking } = useTrackPostView(postId, source);
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
  const { user, loading: authLoading } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!enabled || !takeId || tracked.current || authLoading) return;
    tracked.current = true;

    const queueImpression = () => {
      const sessionId = getSessionId();
      enqueueTakeImpression({
        take_id: takeId,
        viewer_id: user?.id || null,
        session_id: user?.id ? null : sessionId,
        source,
      });
    };

    ensureTakeImpressionFlushListeners();
    const cancelIdle = runWhenIdle(() => {
      queueImpression();
    });

    return () => {
      cancelIdle();
    };
  }, [enabled, takeId, user?.id, authLoading, source]);
}

/**
 * Track take view with watch metrics
 * Returns functions to track play, pause, loop, and completion events
 */
export function useTrackTakeView(
  takeId: string | undefined,
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

  const isAnonymous = !user?.id;

  const recordView = useCallback(async () => {
    if (!takeId || viewRecorded.current) return;
    viewRecorded.current = true;
    await recordContentView("take", takeId, source, isAnonymous);
  }, [takeId, source, isAnonymous]);

  const updateWatchMetrics = useCallback(async () => {
    if (!takeId || !viewRecorded.current) return;

    const watchPercentage =
      takeDurationSeconds > 0
        ? Math.min(100, Math.round((totalWatchTime.current / takeDurationSeconds) * 100))
        : 0;

    await updateContentView(
      "take",
      takeId,
      {
        watch_time_seconds: Math.floor(totalWatchTime.current),
        watch_percentage: watchPercentage,
        loop_count: Math.max(1, loopCount.current),
        completed: hasCompleted.current,
      },
      isAnonymous
    );
  }, [takeId, isAnonymous, takeDurationSeconds]);

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
      viewRecorded.current = true;

      // Server route (it also captures geo headers) decides self/blocked/
      // follower itself; the client no longer sends is_follower.
      try {
        await fetch("/api/track/profile-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          keepalive: true,
          body: JSON.stringify({
            profile_id: profileId,
            session_id: user?.id ? null : getSessionId(),
            source,
          }),
        });
      } catch (err) {
        console.warn("[track/profile-view] request failed", err);
      }
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
      await recordContentView("community", communityId, "direct", !user?.id);
    }, 2000);

    return () => clearTimeout(timer);
  }, [communityId, user?.id]);
}

// ============================================================================
// SOURCE DETECTION HELPER
// ============================================================================

