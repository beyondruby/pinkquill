"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import {
  isThemeId,
  resolveTheme,
  type ConcreteThemeId,
  type ThemeId,
} from "@/lib/theme/registry";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/lib/theme/cookie";

interface ThemeContextValue {
  themeId: ThemeId;            // user's stored preference ('system' or concrete)
  resolvedId: ConcreteThemeId; // theme currently applied to <html>
  setTheme: (id: ThemeId) => void;
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.$?*|{}()[\]\\\/+^]/g, "\\$&");
  const match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

// SSR and the hydration render always use 'system'; the real preference is
// read from the cookie in a layout effect right after hydration (the inline
// script in app/layout.tsx has already stamped <html data-theme> before
// paint, so there is no flash). Reading the cookie during render would make
// the server and client markup disagree.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const [themeId, setThemeIdState] = useState<ThemeId>("system");
  const [prefersDark, setPrefersDark] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);
  // Per-user latch so we don't repeatedly try to seed theme_preference if
  // the first attempt fails or the column is briefly null between fetches.
  const seededUserIdRef = useRef<string | null>(null);

  // First client pass: adopt the cookie preference and the OS setting before
  // anything is painted, then track OS changes live.
  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const cookieRaw = readCookie(THEME_COOKIE);
    setPrefersDark(mq.matches);
    if (cookieRaw && isThemeId(cookieRaw)) {
      setThemeIdState(cookieRaw);
    }
    setHydrated(true);
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedId = useMemo(
    () => resolveTheme(themeId, prefersDark),
    [themeId, prefersDark]
  );

  // The <html data-theme> attribute is the cascade root for every CSS
  // variable override. Updating it is the entire "switch theme" operation.
  // Not before hydration: the inline script's stamp is authoritative until
  // the cookie has been read above.
  useIsomorphicLayoutEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.theme = resolvedId;
    root.dataset.themeMode = themeId === "system" ? "system" : "explicit";
  }, [hydrated, resolvedId, themeId]);

  // Sync from authoritative profile preference once the user is loaded.
  // theme_preference == NULL means "never chosen" → seed it from the cookie
  // (or current state) so the next login on any device reads the right thing.
  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) {
      // Logged out: cookie / current state is authoritative; reset latch.
      seededUserIdRef.current = null;
      return;
    }

    const stored = (profile as { theme_preference?: string | null }).theme_preference;

    if (stored && isThemeId(stored)) {
      // Profile wins on every login; mirror it into local state + cookie.
      if (stored !== themeId) {
        setThemeIdState(stored);
        writeCookie(THEME_COOKIE, stored, THEME_COOKIE_MAX_AGE);
      }
      return;
    }

    // First-ever login (or invalid stored value): seed the profile column
    // from the current preference. Idempotent per user via the ref latch.
    if (seededUserIdRef.current === user.id) return;
    seededUserIdRef.current = user.id;

    const cookieRaw = readCookie(THEME_COOKIE);
    const seedId: ThemeId =
      cookieRaw && isThemeId(cookieRaw) ? cookieRaw : themeId;

    void supabase
      .from("profiles")
      .update({ theme_preference: seedId })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) {
          console.warn("[ThemeProvider] could not seed theme_preference:", error);
          // Allow another attempt on next mount/login if the write failed.
          seededUserIdRef.current = null;
        }
      });
    // themeId intentionally excluded — we want to seed from the value
    // present at first-login moment, not chase every local toggle here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading]);

  const setTheme = useCallback(
    (id: ThemeId) => {
      if (!isThemeId(id)) return;
      setThemeIdState(id);
      writeCookie(THEME_COOKIE, id, THEME_COOKIE_MAX_AGE);
      if (user) {
        void supabase
          .from("profiles")
          .update({ theme_preference: id })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) {
              console.warn("[ThemeProvider] could not save theme_preference:", error);
            }
          });
      }
    },
    [user]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, resolvedId, setTheme, isReady: hydrated && !authLoading }),
    [themeId, resolvedId, setTheme, hydrated, authLoading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
