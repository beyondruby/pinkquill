"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import {
  isFeedViewId,
  DEFAULT_FEED_VIEW,
  type FeedViewId,
} from "@/lib/feed-view/registry";
import {
  FEED_VIEW_COOKIE,
  FEED_VIEW_COOKIE_MAX_AGE,
} from "@/lib/feed-view/cookie";

interface FeedViewContextValue {
  viewId: FeedViewId;
  setView: (id: FeedViewId) => void;
  isReady: boolean;
}

const FeedViewContext = createContext<FeedViewContextValue | null>(null);

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.$?*|{}()[\]\\\/+^]/g, "\\$&");
  const match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

interface FeedViewProviderProps {
  children: React.ReactNode;
}

export function FeedViewProvider({ children }: FeedViewProviderProps) {
  const { user, profile, loading: authLoading } = useAuth();
  // SSR/hydration use the default; the cookie is adopted right after mount
  // (the root layout no longer reads cookies so pages can be static).
  const [viewId, setViewIdState] = useState<FeedViewId>(DEFAULT_FEED_VIEW);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = readCookie(FEED_VIEW_COOKIE);
    if (raw && isFeedViewId(raw)) setViewIdState(raw);
    setHydrated(true);
  }, []);
  // Per-user latch so we don't repeatedly retry seeding feed_view_preference
  // if the first write fails.
  const seededUserIdRef = useRef<string | null>(null);

  // Every fresh login (and signup) resets the feed layout to Classic. The
  // user can switch during the session, but the next time they log in they
  // start from Classic again. `seededUserIdRef` makes this fire once per
  // provider lifetime per user (page load), not on every profile update.
  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) {
      seededUserIdRef.current = null;
      return;
    }

    if (seededUserIdRef.current === user.id) return;
    seededUserIdRef.current = user.id;

    if (viewId !== DEFAULT_FEED_VIEW) {
      setViewIdState(DEFAULT_FEED_VIEW);
    }
    writeCookie(FEED_VIEW_COOKIE, DEFAULT_FEED_VIEW, FEED_VIEW_COOKIE_MAX_AGE);
    // The profile column is only written on an explicit user choice
    // (setView). It used to be rewritten to 'classic' on EVERY page load for
    // any user whose stored value differed — a write per navigation for
    // nothing (docs/audit/01-findings.md L8).
    // viewId intentionally excluded — reset fires once per (user, page-load),
    // not on every local toggle (those are handled in setView).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading]);

  const setView = useCallback(
    (id: FeedViewId) => {
      if (!isFeedViewId(id)) return;
      setViewIdState(id);
      writeCookie(FEED_VIEW_COOKIE, id, FEED_VIEW_COOKIE_MAX_AGE);
      if (user) {
        void supabase
          .from("profiles")
          .update({ feed_view_preference: id })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) {
              console.warn(
                "[FeedViewProvider] could not save feed_view_preference:",
                error
              );
            }
          });
      }
    },
    [user]
  );

  const value = useMemo<FeedViewContextValue>(
    () => ({ viewId, setView, isReady: hydrated && !authLoading }),
    [viewId, setView, hydrated, authLoading]
  );

  return (
    <FeedViewContext.Provider value={value}>
      {children}
    </FeedViewContext.Provider>
  );
}

export function useFeedView(): FeedViewContextValue {
  const ctx = useContext(FeedViewContext);
  if (!ctx) {
    // Fall back to default rather than throwing — keeps non-feed pages safe
    // if they import a feed component without the provider mounted (which
    // shouldn't happen since the provider is at the root, but defensive).
    return {
      viewId: DEFAULT_FEED_VIEW,
      setView: () => {},
      isReady: true,
    };
  }
  return ctx;
}
