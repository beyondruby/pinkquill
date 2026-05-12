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

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.$?*|{}()[\]\\\/+^]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + escaped + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

interface FeedViewProviderProps {
  children: React.ReactNode;
  initialViewId: FeedViewId;
}

export function FeedViewProvider({
  children,
  initialViewId,
}: FeedViewProviderProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const [viewId, setViewIdState] = useState<FeedViewId>(initialViewId);
  // Per-user latch so we don't repeatedly retry seeding feed_view_preference
  // if the first write fails.
  const seededUserIdRef = useRef<string | null>(null);

  // Sync from authoritative profile preference once the user is loaded.
  // feed_view_preference == NULL means "never chosen" → seed from cookie (or
  // current state) so the next login on any device reads the right thing.
  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) {
      seededUserIdRef.current = null;
      return;
    }

    const stored = (profile as { feed_view_preference?: string | null })
      .feed_view_preference;

    if (stored && isFeedViewId(stored)) {
      if (stored !== viewId) {
        setViewIdState(stored);
        writeCookie(FEED_VIEW_COOKIE, stored, FEED_VIEW_COOKIE_MAX_AGE);
      }
      return;
    }

    if (seededUserIdRef.current === user.id) return;
    seededUserIdRef.current = user.id;

    const cookieRaw = readCookie(FEED_VIEW_COOKIE);
    const seedId: FeedViewId =
      cookieRaw && isFeedViewId(cookieRaw) ? cookieRaw : viewId;

    void supabase
      .from("profiles")
      .update({ feed_view_preference: seedId })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) {
          console.warn(
            "[FeedViewProvider] could not seed feed_view_preference:",
            error
          );
          seededUserIdRef.current = null;
        }
      });
    // viewId intentionally excluded — seed from the value at first-login
    // moment, not every local toggle (those are handled in setView).
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
    () => ({ viewId, setView, isReady: !authLoading }),
    [viewId, setView, authLoading]
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
