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
  const fetchProfile = useCallback(async (userId: string, retries = 2): Promise<Profile | null> => {
    const timeoutMs = 8000; // 8 second timeout per attempt

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

  // Handle session changes - with deduplication
  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      fetchingProfileRef.current = null;
      lastSessionIdRef.current = null;
      return;
    }

    // SECURITY: Check if email is confirmed
    // If email_confirmed_at is null, the user hasn't verified their email
    if (!session.user.email_confirmed_at) {
      console.warn("User email not confirmed. Signing out.");
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      fetchingProfileRef.current = null;
      lastSessionIdRef.current = null;
      return;
    }

    const userId = session.user.id;

    // Skip if we already processed this session
    if (lastSessionIdRef.current === userId) {
      return;
    }

    // Skip if we're already fetching this user's profile
    if (fetchingProfileRef.current === userId) {
      return;
    }

    fetchingProfileRef.current = userId;
    setUser(session.user);

    // Fetch or create profile
    let userProfile = await fetchProfile(userId);

    if (!userProfile) {
      userProfile = await createProfile(session.user);
    }

    setProfile(userProfile);
    lastSessionIdRef.current = userId;
    fetchingProfileRef.current = null;
  }, [fetchProfile, createProfile]);

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

    // Timeout to prevent infinite loading (5 seconds max for session check)
    const loadingTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Auth initialization timed out - forcing loading to false");
        setLoading(false);
      }
    }, 5000);

    // Get initial session immediately
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          console.error("Auth session error:", error);
          clearTimeout(loadingTimeout);
          setLoading(false);
          return;
        }

        if (session) {
          // Set user immediately for early access to user.id
          setUser(session.user);
          // Wait for profile fetch to complete before clearing loading
          // This prevents race conditions where components render with user but no profile
          try {
            await handleSession(session);
          } catch (err) {
            console.error("Profile fetch error:", err);
          } finally {
            if (isMounted) {
              clearTimeout(loadingTimeout);
              setLoading(false);
            }
          }
        } else {
          clearTimeout(loadingTimeout);
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (isMounted) {
          clearTimeout(loadingTimeout);
          setLoading(false);
        }
      }
    };

    // Set up auth state listener for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          lastSessionIdRef.current = null;
          fetchingProfileRef.current = null;
          return;
        }

        // Handle sign in and token refresh events
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session) {
            await handleSession(session);
          }
        }
      }
    );

    initAuth();

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [handleSession]);

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
