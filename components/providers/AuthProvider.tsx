"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";

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
  // Track the last processed session to prevent duplicate processing
  const lastSessionIdRef = useRef<string | null>(null);

  // Fetch profile from database with timeout
  const fetchProfile = useCallback(async (userId: string, retries = 1): Promise<Profile | null> => {
    const timeoutMs = 5000; // 5 second timeout per attempt (reduced from 8s)

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const fetchPromise = supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .abortSignal(controller.signal)
          .single();

        const { data, error } = await fetchPromise;
        clearTimeout(timeoutId);

        if (error) {
          // PGRST116 = no rows found - profile doesn't exist yet
          if (error.code === "PGRST116") {
            return null;
          }
          // Abort/timeout or network error - retry
          if ((error.message?.includes("aborted") || error.message?.includes("Failed to fetch")) && attempt < retries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          // Only log non-abort errors
          if (!error.message?.includes("aborted")) {
            console.error("Error fetching profile:", error.message);
          }
          return null;
        }

        return data as Profile;
      } catch (err: any) {
        // Network error or timeout - retry silently
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        // Only log if it's not an abort error
        if (!err?.message?.includes("aborted")) {
          console.error("Failed to fetch profile:", err);
        }
        return null;
      }
    }
    return null;
  }, []);

  // Create profile for new users
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
          username = `${baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${Math.random().toString(36).slice(2, 6)}`;
          attempts++;
        } else if (error.code === "23505" && error.message.includes("profiles_pkey")) {
          // Profile already exists (race condition) - fetch and return it
          const existingProfile = await fetchProfile(user.id, 0);
          if (existingProfile) {
            return existingProfile;
          }
          // If still can't fetch, return null
          return null;
        } else if (error.code === "23503") {
          // Foreign key violation - user doesn't exist in auth.users
          // This happens with stale/corrupted sessions - sign out to clear
          console.warn("Auth user not found in database. Clearing session.");
          await supabase.auth.signOut();
          return null;
        } else {
          // Different error - log and return null
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
    let authInitialized = false;

    // Timeout to prevent infinite loading (10 seconds max - increased for cold starts/slow networks)
    const loadingTimeout = setTimeout(() => {
      if (isMounted && !authInitialized) {
        console.warn("Auth initialization timed out - forcing loading to false");
        setLoading(false);
        authInitialized = true;
      }
    }, 10000);

    // Helper to complete auth initialization
    const completeAuthInit = () => {
      if (!authInitialized) {
        clearTimeout(loadingTimeout);
        setLoading(false);
        authInitialized = true;
      }
    };

    // Process session with email verification check BEFORE setting user
    const processSession = async (session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        fetchingProfileRef.current = null;
        lastSessionIdRef.current = null;
        completeAuthInit();
        return;
      }

      // SECURITY: Check if email is confirmed BEFORE setting user
      // This prevents flash of authenticated state for unverified users
      if (!session.user.email_confirmed_at) {
        console.warn("User email not confirmed. Signing out.");
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        fetchingProfileRef.current = null;
        lastSessionIdRef.current = null;
        completeAuthInit();
        return;
      }

      const userId = session.user.id;

      // Skip if we already processed this session
      if (lastSessionIdRef.current === userId) {
        completeAuthInit();
        return;
      }

      // Skip if we're already fetching this user's profile
      if (fetchingProfileRef.current === userId) {
        return;
      }

      fetchingProfileRef.current = userId;

      // Set user only after email verification passes
      setUser(session.user);
      completeAuthInit();

      // Fetch or create profile in background
      let userProfile = await fetchProfile(userId);

      if (!userProfile) {
        userProfile = await createProfile(session.user);
      }

      if (isMounted) {
        setProfile(userProfile);
        lastSessionIdRef.current = userId;
      }
      fetchingProfileRef.current = null;
    };

    // Set up auth state listener FIRST to catch all events including INITIAL_SESSION
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          lastSessionIdRef.current = null;
          fetchingProfileRef.current = null;
          completeAuthInit();
          return;
        }

        // Handle initial session, sign in, and token refresh events
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await processSession(session);
        }
      }
    );

    // Also call getSession as a fallback in case INITIAL_SESSION doesn't fire
    // (can happen in some edge cases with SSR or stale listeners)
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          console.error("Auth session error:", error);
          completeAuthInit();
          return;
        }

        // Only process if we haven't already initialized via onAuthStateChange
        if (!authInitialized) {
          await processSession(session);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (isMounted) {
          completeAuthInit();
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile, createProfile]);

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
