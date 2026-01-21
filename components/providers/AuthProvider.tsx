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
        console.log("[Auth] Starting initAuth...");
        const startTime = Date.now();

        // Use getUser() instead of getSession() for better security
        // getUser() validates the JWT with the server
        const { data: { user }, error } = await supabase.auth.getUser();
        console.log("[Auth] getUser completed in", Date.now() - startTime, "ms, user:", user?.id || "none", "error:", error?.message || "none");

        if (!isMounted) {
          console.log("[Auth] Component unmounted during auth, aborting");
          return;
        }

        if (error || !user) {
          // No valid user - clear state and finish loading
          console.log("[Auth] No user found, setting loading=false");
          setUser(null);
          setProfile(null);
          setLoading(false);
          completeAuth();
          return;
        }

        // User is authenticated
        console.log("[Auth] User authenticated, setting user and loading=false");
        setUser(user);
        setLoading(false);
        completeAuth();

        // Fetch profile in background (don't block initial render)
        if (fetchingProfileRef.current !== user.id) {
          fetchingProfileRef.current = user.id;
          console.log("[Auth] Fetching profile for user:", user.id);

          let userProfile = await fetchProfile(user.id);
          console.log("[Auth] Profile fetch result:", userProfile ? "found" : "not found");

          if (!userProfile && isMounted) {
            console.log("[Auth] Creating new profile...");
            userProfile = await createProfile(user);
            console.log("[Auth] Profile created:", userProfile ? "success" : "failed");
          }

          if (isMounted) {
            setProfile(userProfile);
            console.log("[Auth] Profile set, auth complete");
          }
          fetchingProfileRef.current = null;
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          completeAuth();
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

          // Fetch profile for newly signed in user
          if (fetchingProfileRef.current !== session.user.id) {
            fetchingProfileRef.current = session.user.id;

            let userProfile = await fetchProfile(session.user.id);

            if (!userProfile && isMounted) {
              userProfile = await createProfile(session.user);
            }

            if (isMounted) {
              setProfile(userProfile);
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
