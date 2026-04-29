"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

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
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_TIMEOUT_MS = 10_000;
const PROFILE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const AUTH_INIT_TIMEOUT_MS = PROFILE_TIMEOUT_MS + 2_000;

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

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

  // Track if we're currently fetching a profile to prevent duplicate fetches
  const fetchingProfileRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const profileRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch profile from database
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

  // Create profile for new users (with timeout protection)
  const createProfile = useCallback(async (user: User, signal?: AbortSignal): Promise<Profile | null> => {
    try {
      const metadata = user.user_metadata || {};
      const baseUsername = metadata.username || user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`;
      const displayName = metadata.display_name || baseUsername;
      let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");

      // Try to insert, if duplicate username, add random suffix
      let attempts = 0;
      while (attempts < 3) {
        if (signal?.aborted) {
          throw new DOMException("Profile request was aborted", "AbortError");
        }

        const query = supabase
          .from("profiles")
          .insert({
            id: user.id,
            username: username,
            display_name: displayName,
            email: user.email?.toLowerCase() || null,
            avatar_url: '/defaultprofile.png',
          })
          .select();
        const { data, error } = await (signal ? query.abortSignal(signal) : query).single();

        if (!error) {
          return data as Profile;
        }

        // If duplicate key error on username, try with suffix
        if (error.code === "23505" && error.message.includes("username")) {
          username = `${baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${crypto.randomUUID().slice(0, 8)}`;
          attempts++;
        } else if (error.code === "23505" && error.message.includes("profiles_pkey")) {
          // Profile already exists (race condition) - fetch and return it
          const existingProfile = await fetchProfile(user.id, signal);
          if (existingProfile) {
            return existingProfile;
          }
          return null;
        } else if (error.code === "23503") {
          // Foreign key violation - user doesn't exist in auth.users
          console.warn("Auth user not found in database. Clearing session.");
          await supabase.auth.signOut();
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

  /**
   * Fetch profile, creating it if necessary, with a hard timeout that
   * also aborts the underlying Supabase request.
   */
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
        let profile = await fetchProfile(authUser.id, controller.signal);
        if (!profile) {
          profile = await createProfile(authUser, controller.signal);
        }
        return profile;
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

  // Refresh profile (useful after profile updates)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const updatedProfile = await fetchOrCreateProfileWithTimeout(user);
    if (updatedProfile) {
      setProfile(updatedProfile);
    } else {
      scheduleProfileRetry(user);
    }
  }, [user, fetchOrCreateProfileWithTimeout, scheduleProfileRetry]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let authCompleted = false;

    // CRITICAL: Timeout safeguard to prevent infinite loading.
    // Initial auth waits for the first profile attempt, so this is slightly
    // longer than the profile timeout.
    const timeoutId = setTimeout(() => {
      if (isMounted && !authCompleted) {
        console.warn(`Auth initialization timed out after ${AUTH_INIT_TIMEOUT_MS / 1000}s - forcing completion`);
        setLoading(false);
        authCompleted = true;
      }
    }, AUTH_INIT_TIMEOUT_MS);

    const completeAuth = () => {
      if (!authCompleted) {
        clearTimeout(timeoutId);
        authCompleted = true;
      }
    };

    const initAuth = async () => {
      try {
        // Step 1: Quick check with getSession() - reads from localStorage, no network call
        // This gives us a fast initial state while we validate in background
        const { data: { session: localSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!localSession?.user) {
          // No local session - user is definitely not logged in
          activeUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setLoading(false);
          completeAuth();
          return;
        }

        // We have a local session, but keep auth loading until the first
        // profile attempt finishes so profile-dependent hooks do not start
        // in a partial user-without-profile state.
        activeUserIdRef.current = localSession.user.id;
        setUser(localSession.user);

        // Step 2: Fetch profile immediately (doesn't need getUser validation)
        // Uses a 10s timeout so a hanging profile fetch/create never blocks forever.
        const userIdToFetch = localSession.user.id;
        if (fetchingProfileRef.current !== userIdToFetch) {
          fetchingProfileRef.current = userIdToFetch;

          const userProfile = await fetchOrCreateProfileWithTimeout(localSession.user);

          if (isMounted && fetchingProfileRef.current === userIdToFetch) {
            if (userProfile) {
              setProfile(userProfile);
            } else {
              console.warn("Auth user exists but profile fetch failed. Scheduling retry.");
              scheduleProfileRetry(localSession.user);
            }
            setLoading(false);
            completeAuth();
          }
          fetchingProfileRef.current = null;
        } else {
          setLoading(false);
          completeAuth();
        }

        // Step 3: Session validation is handled PASSIVELY, not here.
        // We do NOT call getUser() during init because it:
        //   1. Acquires the Supabase internal auth lock for its entire network call
        //   2. ALL concurrent data queries (useFeed, useExplore, etc.) also need this lock
        //   3. If getUser() takes >5s (slow network), data queries are blocked and can time out
        // Instead, we rely on:
        //   - autoRefreshToken: true (automatically refreshes expired tokens)
        //   - onAuthStateChange: catches TOKEN_REFRESHED and SIGNED_OUT events
        //   - If the token is revoked, the next auto-refresh will fail and fire SIGNED_OUT
      } catch (err) {
        console.error("Auth init error:", err);
        if (isMounted) {
          // Only clear user if we never set one (loading is still true)
          if (!authCompleted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            completeAuth();
          }
          // If auth already completed (user was set from local session),
          // don't clear it — the local session is still usable
        }
      }
    };

    // Set up auth state listener for sign in/out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          activeUserIdRef.current = null;
          clearProfileRetry();
          setUser(null);
          setProfile(null);
          fetchingProfileRef.current = null;
          completeAuth();
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          activeUserIdRef.current = session.user.id;
          clearProfileRetry();
          setUser(session.user);
          setLoading(true);

          // Fetch profile for newly signed in user with timeout protection
          const userIdToFetch = session.user.id;
          if (fetchingProfileRef.current !== userIdToFetch) {
            fetchingProfileRef.current = userIdToFetch;

            const userProfile = await fetchOrCreateProfileWithTimeout(session.user);

            // Check if we're still fetching for the same user (prevents race condition)
            if (fetchingProfileRef.current !== userIdToFetch) {
              return;
            }

            if (isMounted && fetchingProfileRef.current === userIdToFetch) {
              if (userProfile) {
                setProfile(userProfile);
              } else {
                console.warn("Profile unavailable after sign-in. Scheduling retry.");
                scheduleProfileRetry(session.user);
              }
              setLoading(false);
              completeAuth();
            }
            fetchingProfileRef.current = null;
          } else {
            setLoading(false);
            completeAuth();
          }
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          // Just update the user object, profile doesn't need refresh
          activeUserIdRef.current = session.user.id;
          setUser(session.user);
        }

        // Handle USER_UPDATED event (fires when user metadata changes)
        if (event === "USER_UPDATED" && session?.user) {
          activeUserIdRef.current = session.user.id;
          setUser(session.user);
        }

        // Handle INITIAL_SESSION event (fires when page loads with existing session)
        // CRITICAL: Do NOT set user/loading here - let initAuth() handle initial load
        // This prevents race conditions where child components start fetching before
        // getUser() validates the session with the server.
        // initAuth() runs immediately after this listener is set up, so it will
        // properly validate and set the user state.
        if (event === "INITIAL_SESSION") {
          // Intentionally do nothing here - initAuth() handles the initial session
          // This prevents premature loading=false which would trigger child component fetches
          return;
        }
      }
    );

    initAuth();

    return () => {
      isMounted = false;
      clearProfileRetry();
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [clearProfileRetry, fetchOrCreateProfileWithTimeout, scheduleProfileRetry]);

  // Recover auth state when the tab becomes visible again.
  // If the session expired while the tab was hidden, the Supabase client's
  // auto-refresh may have failed silently. Re-reading the session on visibility
  // change ensures the React state stays in sync with localStorage.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Session exists — make sure React state matches
          activeUserIdRef.current = session.user.id;
          setUser((prev) => {
            if (!prev || prev.id !== session.user.id) {
              return session.user;
            }
            return prev;
          });

          // Retry profile fetch if it previously failed
          if (!profile && fetchingProfileRef.current !== session.user.id) {
            fetchingProfileRef.current = session.user.id;
            const userProfile = await fetchOrCreateProfileWithTimeout(session.user);
            if (userProfile && fetchingProfileRef.current === session.user.id) {
              setProfile(userProfile);
            } else if (!userProfile) {
              scheduleProfileRetry(session.user);
            }
            fetchingProfileRef.current = null;
          }
        } else if (user) {
          // localStorage session is gone but React state still has a user.
          // This means Supabase cleared the session (e.g., refresh token expired).
          // Clear React state to match.
          activeUserIdRef.current = null;
          clearProfileRetry();
          setUser(null);
          setProfile(null);
        }
      } catch {
        // Ignore — the auto-refresh will handle it
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, profile, clearProfileRetry, fetchOrCreateProfileWithTimeout, scheduleProfileRetry]);

  // Sign out: server route is the source of truth. /api/auth/logout uses the
  // @supabase/ssr server client, which clears cookies with the exact same
  // Path/Domain/SameSite attributes they were set with — this is the only
  // 100%-reliable way to delete the session. Calling supabase.auth.signOut()
  // from the browser is not enough on its own, because the browser client
  // writes cookie expirations via document.cookie which can fail to match
  // server-set attributes and leave the cookies behind.
  //
  // Order:
  //  1. Hit /api/auth/logout — server returns Set-Cookie headers that expire
  //     every sb-* cookie. Browser applies them.
  //  2. Belt-and-suspenders: manually expire any sb-* cookie still visible
  //     to JS, in case anything was set with a path other than "/".
  //  3. Best-effort supabase.auth.signOut() to fire SIGNED_OUT and tear down
  //     realtime channels.
  //  4. Hard navigate to "/" so the next page is rendered with no session.
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

      // Manual belt-and-suspenders cookie clear. Iterate over every cookie
      // visible to JS and expire any that look like a Supabase session
      // cookie. We try a couple of common path values to dislodge cookies
      // that might have been written with non-default options.
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

      await supabase.auth.signOut().catch((err) => {
        console.warn("supabase.auth.signOut error:", err);
      });

      setUser(null);
      setProfile(null);
      // Hard navigation so the next page renders with cleared cookies and
      // no stale React state from the previous session.
      window.location.replace("/");
    } catch (err) {
      console.error("Sign out error:", err);
      window.location.replace("/");
    }
  }, [clearProfileRetry]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
