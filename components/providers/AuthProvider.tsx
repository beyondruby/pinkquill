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
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Fetch profile from database
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

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
      console.error("Failed to fetch profile:", err);
      return null;
    }
  }, []);

  // Create profile for new users (with timeout protection)
  const createProfile = useCallback(async (user: User): Promise<Profile | null> => {
    try {
      const metadata = user.user_metadata || {};
      const baseUsername = metadata.username || user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`;
      const displayName = metadata.display_name || baseUsername;
      let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");

      // Try to insert, if duplicate username, add random suffix
      let attempts = 0;
      while (attempts < 3) {
        const { data, error } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            username: username,
            display_name: displayName,
            email: user.email?.toLowerCase() || null,
            avatar_url: '/defaultprofile.png',
          })
          .select()
          .single();

        if (!error) {
          return data as Profile;
        }

        // If duplicate key error on username, try with suffix
        if (error.code === "23505" && error.message.includes("username")) {
          username = `${baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${crypto.randomUUID().slice(0, 8)}`;
          attempts++;
        } else if (error.code === "23505" && error.message.includes("profiles_pkey")) {
          // Profile already exists (race condition) - fetch and return it
          const existingProfile = await fetchProfile(user.id);
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
      console.error("Failed to create profile:", err);
      return null;
    }
  }, [fetchProfile]);

  /**
   * Fetch profile, creating it if necessary, with a hard 10s timeout
   * so the operation never hangs indefinitely. Returns null on timeout
   * or failure -- the user will still be set (auth works) but profile
   * will be missing until the next page load.
   */
  const fetchOrCreateProfileWithTimeout = useCallback(
    async (authUser: User): Promise<Profile | null> => {
      const PROFILE_TIMEOUT_MS = 10_000;

      const profilePromise = (async () => {
        let profile = await fetchProfile(authUser.id);
        if (!profile) {
          profile = await createProfile(authUser);
        }
        return profile;
      })();

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn(
            `Profile fetch/create timed out after ${PROFILE_TIMEOUT_MS / 1000}s for user ${authUser.id}`
          );
          resolve(null);
        }, PROFILE_TIMEOUT_MS);
      });

      return Promise.race([profilePromise, timeoutPromise]);
    },
    [fetchProfile, createProfile]
  );

  // Refresh profile (useful after profile updates)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const updatedProfile = await fetchProfile(user.id);
    if (updatedProfile) {
      setProfile(updatedProfile);
    }
  }, [user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let authCompleted = false;

    // CRITICAL: Timeout safeguard to prevent infinite loading
    // If auth doesn't complete in 8 seconds, force loading to false
    const timeoutId = setTimeout(() => {
      if (isMounted && !authCompleted) {
        console.warn("Auth initialization timed out after 8s - forcing completion");
        setLoading(false);
        authCompleted = true;
      }
    }, 8000);

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
          setUser(null);
          setProfile(null);
          setLoading(false);
          completeAuth();
          return;
        }

        // We have a local session - use it immediately for fast UI
        // CRITICAL: Set user + loading=false so child components can start
        // fetching data immediately. The Supabase client already has the JWT
        // in its internal store from getSession(), so queries will work.
        setUser(localSession.user);
        setLoading(false);
        completeAuth();

        // Step 2: Fetch profile immediately (doesn't need getUser validation)
        // Uses a 10s timeout so a hanging profile fetch/create never blocks forever.
        const userIdToFetch = localSession.user.id;
        if (fetchingProfileRef.current !== userIdToFetch) {
          fetchingProfileRef.current = userIdToFetch;

          const userProfile = await fetchOrCreateProfileWithTimeout(localSession.user);

          if (isMounted && fetchingProfileRef.current === userIdToFetch) {
            setProfile(userProfile);
            if (!userProfile) {
              // Profile missing after timeout or failure. The user is still
              // authenticated so the app can function with limited profile data.
              // The next page load will retry.
              console.warn("Auth user exists but profile is null. Will retry on next load.");
            }
          }
          fetchingProfileRef.current = null;
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
          setUser(null);
          setProfile(null);
          fetchingProfileRef.current = null;
          completeAuth();
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);
          setLoading(false);
          completeAuth();

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
              setProfile(userProfile);
              if (!userProfile) {
                console.warn("Profile unavailable after sign-in. Will retry on next load.");
              }
            }
            fetchingProfileRef.current = null;
          }
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          // Just update the user object, profile doesn't need refresh
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
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile, createProfile, fetchOrCreateProfileWithTimeout]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      window.location.href = "/";
    } catch (err) {
      console.error("Sign out error:", err);
      // Force redirect even on error
      window.location.href = "/";
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
