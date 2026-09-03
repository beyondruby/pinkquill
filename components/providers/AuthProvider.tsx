"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { reportAuthDiagnostic } from "@/lib/diagnostics/authDiagnostics";
import { isAbortError } from "@/lib/utils/retry";

/**
 * Push the current session JWT into the realtime client. Required for
 * private broadcast channels (e.g. `user-events:${userId}`) — without an
 * explicit token, those channels stay in "joining" state forever, which
 * blocks every hook that depends on UserEventsProvider (notifications,
 * unread counts, follow requests).
 *
 * Pass `null` on sign-out so the next subscribe attempt doesn't reuse a
 * stale token.
 */
function syncRealtimeAuth(token: string | null) {
  try {
    // The realtime client ignores stale tokens — calling setAuth on every
    // auth event keeps it in lockstep with the cookie store.
    supabase.realtime.setAuth(token ?? undefined);
  } catch (err) {
    console.warn("[AuthProvider] realtime.setAuth failed:", err);
  }
}

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  tagline: string | null;
  role: string | null;
  education: string | null;
  location: string | null;
  languages: string | null;
  website: string | null;
  is_verified: boolean;
  is_private: boolean;
  theme_preference: string | null;
  notification_preferences: Record<string, boolean> | null;
  email_preferences?: Record<string, boolean> | null;
}

/**
 * Four-state auth status. The important distinction is `unknown` vs
 * `anonymous`: `anonymous` is a *resolved* "there is no session"; `unknown`
 * means we gave up waiting (12s) without an answer. Route guards must only
 * redirect to /login on `anonymous` — bouncing a signed-in user because a
 * lock or a slow network delayed the answer was one of the "site doesn't
 * load" causes (docs/audit/01-findings.md H3).
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous" | "unknown";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  /** True until the first profile attempt for the current user has finished. */
  loading: boolean;
  status: AuthStatus;
  /** Resolved "no session". Use this (not `!user`) to decide on redirects. */
  isAnonymous: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Re-run session detection after a `status === "unknown"` timeout. */
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_TIMEOUT_MS = 10_000;
const PROFILE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const AUTH_INIT_TIMEOUT_MS = PROFILE_TIMEOUT_MS + 2_000;
const AUTH_INIT_SLOW_MS = 8_000;

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Bumped to force the profile effect to re-run for the same user
  // (visibility return, manual retry) without changing `user`.
  const [profileNonce, setProfileNonce] = useState(0);
  const [initNonce, setInitNonce] = useState(0);

  const activeUserIdRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const fetchingProfileRef = useRef<string | null>(null);
  const profileRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ---------------------------------------------------------------------------
  // Profile fetch / create. These run from effects, NEVER from inside the
  // onAuthStateChange callback (see the comment on the listener below).
  // ---------------------------------------------------------------------------
  const fetchProfile = useCallback(async (userId: string, signal?: AbortSignal): Promise<Profile | null> => {
    try {
      const query = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId);
      const { data, error } = await (signal ? query.abortSignal(signal) : query).single();

      if (error) {
        // PGRST116 = no rows found - profile doesn't exist yet
        if (error.code === "PGRST116") {
          return null;
        }
        console.error("Error fetching profile:", error.message);
        return null;
      }

      return data as Profile;
    } catch (err) {
      if (isAbortError(err)) throw err;
      console.error("Failed to fetch profile:", err);
      return null;
    }
  }, []);

  // Create profile for new users. The DB trigger `handle_new_user` normally
  // does this; this is the fallback for accounts created before the trigger.
  const createProfile = useCallback(async (authUser: User, signal?: AbortSignal): Promise<Profile | null> => {
    try {
      const metadata = authUser.user_metadata || {};
      const baseUsername = metadata.username || authUser.email?.split("@")[0] || `user_${authUser.id.slice(0, 8)}`;
      const displayName = metadata.display_name || baseUsername;
      let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");

      let attempts = 0;
      while (attempts < 3) {
        if (signal?.aborted) {
          throw new DOMException("Profile request was aborted", "AbortError");
        }

        const query = supabase
          .from("profiles")
          .insert({
            id: authUser.id,
            username: username,
            display_name: displayName,
            email: authUser.email?.toLowerCase() || null,
            avatar_url: '/defaultprofile.png',
          })
          .select();
        const { data, error } = await (signal ? query.abortSignal(signal) : query).single();

        if (!error) {
          return data as Profile;
        }

        if (error.code === "23505" && error.message.includes("username")) {
          username = `${baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${crypto.randomUUID().slice(0, 8)}`;
          attempts++;
        } else if (error.code === "23505" && error.message.includes("profiles_pkey")) {
          // Profile already exists (race with the DB trigger) - fetch it
          return await fetchProfile(authUser.id, signal);
        } else if (error.code === "23503") {
          // Foreign key violation - the auth user no longer exists. Do NOT
          // call supabase.auth.signOut() here: this can run while auth-js
          // holds its cross-tab lock and would deadlock the client. Leave
          // the profile null; the next refresh will fail and sign out
          // cleanly.
          console.warn("Auth user not found in database; profile cannot be created.");
          return null;
        } else {
          console.error("Error creating profile:", error.message);
          return null;
        }
      }

      console.error("Failed to create profile after multiple attempts");
      return null;
    } catch (err) {
      if (isAbortError(err)) throw err;
      console.error("Failed to create profile:", err);
      return null;
    }
  }, [fetchProfile]);

  const fetchOrCreateProfileWithTimeout = useCallback(
    async (authUser: User): Promise<Profile | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(
          `Profile fetch/create timed out after ${PROFILE_TIMEOUT_MS / 1000}s for user ${authUser.id}`
        );
        controller.abort(new DOMException("Profile request timed out", "AbortError"));
      }, PROFILE_TIMEOUT_MS);

      try {
        let nextProfile = await fetchProfile(authUser.id, controller.signal);
        if (!nextProfile) {
          nextProfile = await createProfile(authUser, controller.signal);
        }
        return nextProfile;
      } catch (err) {
        if (!isAbortError(err)) {
          console.error("Profile fetch/create failed:", err);
        }
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [fetchProfile, createProfile]
  );

  const clearProfileRetry = useCallback(() => {
    if (profileRetryTimeoutRef.current) {
      clearTimeout(profileRetryTimeoutRef.current);
      profileRetryTimeoutRef.current = null;
    }
  }, []);

  const scheduleProfileRetry = useCallback(
    (authUser: User, attempt = 0) => {
      clearProfileRetry();

      if (attempt >= PROFILE_RETRY_DELAYS_MS.length) {
        console.warn("Profile unavailable after retries. It will retry when the tab becomes visible.");
        return;
      }

      profileRetryTimeoutRef.current = setTimeout(async () => {
        if (activeUserIdRef.current !== authUser.id) return;

        if (fetchingProfileRef.current && fetchingProfileRef.current !== authUser.id) {
          scheduleProfileRetry(authUser, attempt + 1);
          return;
        }

        fetchingProfileRef.current = authUser.id;
        const userProfile = await fetchOrCreateProfileWithTimeout(authUser);

        if (activeUserIdRef.current === authUser.id) {
          if (userProfile) {
            setProfile(userProfile);
          } else {
            scheduleProfileRetry(authUser, attempt + 1);
          }
        }

        if (fetchingProfileRef.current === authUser.id) {
          fetchingProfileRef.current = null;
        }
      }, PROFILE_RETRY_DELAYS_MS[attempt]);
    },
    [clearProfileRetry, fetchOrCreateProfileWithTimeout]
  );

  useEffect(() => {
    return () => clearProfileRetry();
  }, [clearProfileRetry]);

  const refreshProfile = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    const updatedProfile = await fetchOrCreateProfileWithTimeout(current);
    if (updatedProfile) {
      setProfile(updatedProfile);
    } else {
      scheduleProfileRetry(current);
    }
  }, [fetchOrCreateProfileWithTimeout, scheduleProfileRetry]);

  // ---------------------------------------------------------------------------
  // Apply a session to React state. Synchronous — safe to call from the
  // auth listener. Compares by id so token refreshes do not hand consumers a
  // new `user` object (several effects key on it and would refetch/re-subscribe).
  // ---------------------------------------------------------------------------
  const applySession = useCallback((session: Session, replaceUserObject = false) => {
    const nextUser = session.user;
    activeUserIdRef.current = nextUser.id;
    syncRealtimeAuth(session.access_token);
    setUser((prev) => (prev && prev.id === nextUser.id && !replaceUserObject ? prev : nextUser));
    setStatus("authenticated");
    if (profileRef.current?.id === nextUser.id) {
      setLoading(false);
    }
    // Otherwise the profile effect below flips loading once it has tried.
  }, []);

  const applySignedOut = useCallback(() => {
    activeUserIdRef.current = null;
    syncRealtimeAuth(null);
    clearProfileRetry();
    fetchingProfileRef.current = null;
    setUser(null);
    setProfile(null);
    setStatus("anonymous");
    setLoading(false);
  }, [clearProfileRetry]);

  // ---------------------------------------------------------------------------
  // Auth listener + initial session detection.
  //
  // IMPORTANT: the onAuthStateChange callback must stay synchronous and must
  // not call any Supabase method. auth-js 2.x emits SIGNED_IN from *inside*
  // its cross-tab Web Locks lock (during initialize() and on every
  // visibilitychange) and awaits every callback; any Supabase call from
  // here (a profiles query, signOut, getSession) needs that same lock and
  // deadlocks the client — and, because the lock is shared across tabs,
  // every other Pinkquill tab with it. See docs/audit/01-findings.md H1.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    let settled = false;
    const startedAt = Date.now();

    const settle = () => {
      settled = true;
    };

    const slowTimer = setTimeout(() => {
      if (isMounted && !settled) {
        void reportAuthDiagnostic("auth_init_slow", { elapsedMs: Date.now() - startedAt });
      }
    }, AUTH_INIT_SLOW_MS);

    // Hard cap so the UI never waits forever. We do NOT pretend the user is
    // signed out here: status becomes "unknown" and guards show a retry UI.
    const timeoutId = setTimeout(() => {
      if (isMounted && !settled) {
        console.warn(`Auth initialization timed out after ${AUTH_INIT_TIMEOUT_MS / 1000}s`);
        void reportAuthDiagnostic("auth_init_timeout", { elapsedMs: Date.now() - startedAt });
        settle();
        setStatus((prev) => (prev === "loading" ? "unknown" : prev));
        setLoading(false);
      }
    }, AUTH_INIT_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        settle();
        applySignedOut();
        return;
      }

      if (session?.user) {
        settle();
        applySession(session, event === "USER_UPDATED");
        return;
      }

      if (event === "INITIAL_SESSION") {
        // Initialised with no session: a resolved "anonymous".
        settle();
        if (activeUserIdRef.current === null) applySignedOut();
      }
    });

    const initAuth = async () => {
      try {
        // getSession() reads the cookie store; it only goes to the network
        // when the token is within 90s of expiry. It waits for auth-js
        // initialisation and its cross-tab lock — both bounded in
        // lib/supabase.ts.
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        settle();
        if (session?.user) {
          applySession(session);
        } else if (activeUserIdRef.current === null) {
          applySignedOut();
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (!isMounted) return;
        void reportAuthDiagnostic("auth_init_error", {
          elapsedMs: Date.now() - startedAt,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
        if (!settled) {
          settle();
          setStatus((prev) => (prev === "loading" ? "unknown" : prev));
          setLoading(false);
        }
      }
    };

    void initAuth();

    return () => {
      isMounted = false;
      clearTimeout(slowTimer);
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [applySession, applySignedOut, initNonce]);

  // ---------------------------------------------------------------------------
  // Profile loader: runs whenever the signed-in user id changes (or a retry
  // is requested). This is where the Supabase queries live — outside the auth
  // callback, outside the lock.
  // ---------------------------------------------------------------------------
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    const authUser = userRef.current;
    if (!authUser || authUser.id !== userId) return;

    if (profileRef.current?.id === userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    clearProfileRetry();
    fetchingProfileRef.current = userId;

    (async () => {
      const userProfile = await fetchOrCreateProfileWithTimeout(authUser);
      if (cancelled || activeUserIdRef.current !== userId) return;
      if (userProfile) {
        setProfile(userProfile);
      } else {
        console.warn("Profile unavailable after first attempt. Scheduling retry.");
        scheduleProfileRetry(authUser);
      }
      setLoading(false);
      if (fetchingProfileRef.current === userId) {
        fetchingProfileRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profileNonce, clearProfileRetry, fetchOrCreateProfileWithTimeout, scheduleProfileRetry]);

  // Recover auth state when the tab becomes visible again. auth-js runs its
  // own recovery under the lock; we only read the result afterwards.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          applySession(session);
          if (!profileRef.current || profileRef.current.id !== session.user.id) {
            setProfileNonce((n) => n + 1);
          }
        } else if (activeUserIdRef.current) {
          // Cookie session is gone (refresh token expired) but React still
          // has a user — align state.
          applySignedOut();
        }
      } catch {
        // Ignore — the auto-refresh will handle it
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [applySession, applySignedOut]);

  const retryAuth = useCallback(() => {
    setStatus("loading");
    setLoading(true);
    setInitNonce((n) => n + 1);
  }, []);

  // Sign out: server route is the source of truth. /api/auth/logout uses the
  // @supabase/ssr server client, which clears cookies with the exact same
  // Path/Domain/SameSite attributes they were set with — this is the only
  // 100%-reliable way to delete the session. Calling supabase.auth.signOut()
  // from the browser is not enough on its own, because the browser client
  // writes cookie expirations via document.cookie which can fail to match
  // server-set attributes and leave the cookies behind.
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      clearProfileRetry();
      activeUserIdRef.current = null;

      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch((err) => {
        console.warn("/api/auth/logout failed:", err);
      });

      if (typeof document !== "undefined") {
        const names = document.cookie
          .split(";")
          .map((c) => c.split("=")[0]?.trim())
          .filter((name): name is string => Boolean(name && name.startsWith("sb-")));
        for (const name of names) {
          for (const path of ["/", ""]) {
            document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
          }
        }
      }

      syncRealtimeAuth(null);
      await supabase.auth.signOut().catch((err) => {
        console.warn("supabase.auth.signOut error:", err);
      });

      setUser(null);
      setProfile(null);
      setStatus("anonymous");
      window.location.replace("/");
    } catch (err) {
      console.error("Sign out error:", err);
      window.location.replace("/");
    }
  }, [clearProfileRetry]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        status,
        isAnonymous: status === "anonymous",
        signOut,
        refreshProfile,
        retryAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
