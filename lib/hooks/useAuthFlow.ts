"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { loginWithIdentifier } from "@/lib/auth-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthStep = "credentials" | "otp";

/** Tracks which flow triggered the OTP so verifyOtp gets the right `type`. */
export type OtpFlow = "signup" | "recovery";

export interface AuthFlowState {
  isLogin: boolean;
  step: AuthStep;
  emailOrUsername: string;
  password: string;
  username: string;
  displayName: string;
  otpCode: string[];
  pendingEmail: string;
  resendCooldown: number;
  loading: boolean;
  error: string | null;
  message: string | null;
}

export interface AuthFlowActions {
  setIsLogin: (v: boolean) => void;
  setStep: (v: AuthStep) => void;
  setEmailOrUsername: (v: string) => void;
  setPassword: (v: string) => void;
  setUsername: (v: string) => void;
  setDisplayName: (v: string) => void;
  setOtpCode: (v: string[]) => void;
  setError: (v: string | null) => void;
  setMessage: (v: string | null) => void;

  /** Submit credentials (login or signup). Returns `"redirect"` when the
   *  caller should navigate away (e.g. successful login). */
  handleCredentialsSubmit: (e: React.FormEvent) => Promise<"redirect" | "otp" | "error">;

  /** Submit the 6-digit OTP code. Pass the joined string or omit to use
   *  the current `otpCode` array. Returns `"redirect"` on success. */
  handleOtpSubmit: (code?: string) => Promise<"redirect" | "error">;

  /** Resend the OTP email. */
  handleResendCode: () => Promise<void>;

  /** Go back from OTP to credentials step, resetting OTP state. */
  handleBackToCredentials: () => void;

  /** Toggle between login / signup mode, resetting all state. */
  toggleMode: () => void;

  /** Reset the entire form to its initial state. */
  resetForm: () => void;

  /** Handle a single OTP digit change (auto-focus next). */
  handleOtpChange: (index: number, value: string, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => void;

  /** Handle backspace in OTP inputs (move to previous). */
  handleOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => void;

  /** Handle paste into OTP inputs. Does NOT auto-submit. */
  handleOtpPaste: (e: React.ClipboardEvent, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => void;

  /** Start the resend cooldown timer. Call once per mount/step change. */
  tickResendCooldown: () => void;
}

// ---------------------------------------------------------------------------
// Username validation (alphanumeric + underscore)
// ---------------------------------------------------------------------------

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

function validateUsername(raw: string): string | null {
  const cleaned = raw.replace(/^@/, "").trim();
  if (!cleaned) return "Username is required";
  if (cleaned.length < 2) return "Username must be at least 2 characters";
  if (cleaned.length > 30) return "Username must be 30 characters or fewer";
  if (!USERNAME_RE.test(cleaned)) return "Username can only contain letters, numbers, and underscores";
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuthFlow() {
  // ---- state ----
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>("credentials");

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Which flow we entered the OTP screen from. */
  const otpFlowRef = useRef<OtpFlow>("signup");

  /** Prevent double-submit. */
  const pendingRef = useRef(false);

  // ---- helpers ----

  const resetOtp = useCallback(() => {
    setOtpCode(["", "", "", "", "", ""]);
  }, []);

  const resetForm = useCallback(() => {
    setStep("credentials");
    setEmailOrUsername("");
    setPassword("");
    setUsername("");
    setDisplayName("");
    resetOtp();
    setPendingEmail("");
    setError(null);
    setMessage(null);
  }, [resetOtp]);

  const toggleMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setStep("credentials");
    setError(null);
    setMessage(null);
    resetOtp();
  }, [resetOtp]);

  const handleBackToCredentials = useCallback(() => {
    setStep("credentials");
    resetOtp();
    setError(null);
    setMessage(null);
  }, [resetOtp]);

  // ---- cooldown ticker ----

  const tickResendCooldown = useCallback(() => {
    setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  // ---- OTP input handlers ----

  const handleOtpChange = useCallback(
    (index: number, value: string, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => {
      if (value && !/^\d$/.test(value)) return;

      setOtpCode((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });

      // Auto-focus next input (do NOT auto-submit)
      if (value && index < 5) {
        refs.current[index + 1]?.focus();
      }
    },
    []
  );

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => {
      if (e.key === "Backspace" && !otpCode[index] && index > 0) {
        refs.current[index - 1]?.focus();
      }
    },
    [otpCode]
  );

  /** Paste handler -- fills all 6 digits but does NOT auto-submit. */
  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pastedData.length > 0) {
        const digits = pastedData.split("");
        // Pad to 6 if shorter
        while (digits.length < 6) digits.push("");
        setOtpCode(digits);
        // Focus last filled input
        const lastIdx = Math.min(pastedData.length - 1, 5);
        refs.current[lastIdx]?.focus();
      }
    },
    []
  );

  // ---- credentials submit ----

  const handleCredentialsSubmit = useCallback(
    async (e: React.FormEvent): Promise<"redirect" | "otp" | "error"> => {
      e.preventDefault();
      if (pendingRef.current) return "error";
      pendingRef.current = true;
      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        if (isLogin) {
          // ---- LOGIN ----
          const result = await loginWithIdentifier(emailOrUsername, password);

          if (!result.success) {
            if (result.requiresVerification && result.pendingEmail) {
              otpFlowRef.current = "signup";
              setPendingEmail(result.pendingEmail);
              setResendCooldown(60);
              setStep("otp");
              setMessage(result.message || "Please verify your email with the code we sent.");
              return "otp";
            }
            throw new Error(result.error || "Unable to sign in right now.");
          }

          return "redirect";
        } else {
          // ---- SIGNUP ----
          // Client-side username validation
          const usernameError = validateUsername(username);
          if (usernameError) {
            throw new Error(usernameError);
          }

          const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();

          const { data, error: signUpError } = await supabase.auth.signUp({
            email: emailOrUsername,
            password,
            options: {
              data: {
                username: cleanUsername,
                display_name: displayName,
              },
            },
          });

          if (signUpError) throw signUpError;

          // User already exists (identities empty)
          if (data.user?.identities?.length === 0) {
            throw new Error("An account with this email already exists. Please sign in.");
          }

          const needsEmailConfirmation = !data.session;

          if (data.user && needsEmailConfirmation) {
            // Try to create profile (may fail if RLS requires email verification)
            try {
              await supabase.from("profiles").insert({
                id: data.user.id,
                username: cleanUsername,
                display_name: displayName,
                email: emailOrUsername.toLowerCase(),
                avatar_url: "/defaultprofile.png",
              });
            } catch {
              // Profile will be created after email confirmation by AuthProvider
            }

            otpFlowRef.current = "signup";
            setPendingEmail(emailOrUsername);
            setResendCooldown(60);
            setStep("otp");
            return "otp";
          } else if (data.session) {
            // Auto-confirmed (shouldn't happen in production)
            if (data.user) {
              try {
                await supabase.from("profiles").insert({
                  id: data.user.id,
                  username: cleanUsername,
                  display_name: displayName,
                  email: emailOrUsername.toLowerCase(),
                  avatar_url: "/defaultprofile.png",
                });
              } catch {
                // AuthProvider will handle profile creation
              }
            }
            return "redirect";
          }
        }

        return "error";
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        return "error";
      } finally {
        setLoading(false);
        pendingRef.current = false;
      }
    },
    [isLogin, emailOrUsername, password, username, displayName]
  );

  // ---- OTP submit ----

  const handleOtpSubmit = useCallback(
    async (code?: string): Promise<"redirect" | "error"> => {
      const otpString = code || otpCode.join("");
      if (otpString.length !== 6) {
        setError("Please enter all 6 digits");
        return "error";
      }

      if (pendingRef.current) return "error";
      pendingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // Use the correct OTP type based on which flow got us here
        const otpType = otpFlowRef.current === "recovery" ? "recovery" : "signup";

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: pendingEmail,
          token: otpString,
          type: otpType,
        });

        if (verifyError) {
          if (
            verifyError.message.includes("Token has expired") ||
            verifyError.message.includes("invalid")
          ) {
            setError("Invalid or expired code. Please try again or resend.");
          } else {
            setError(verifyError.message);
          }
          resetOtp();
          return "error";
        }

        if (data.user) {
          return "redirect";
        }

        return "error";
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Verification failed";
        setError(errorMessage);
        resetOtp();
        return "error";
      } finally {
        setLoading(false);
        pendingRef.current = false;
      }
    },
    [otpCode, pendingEmail, resetOtp]
  );

  // ---- resend code ----

  const handleResendCode = useCallback(async () => {
    if (resendCooldown > 0 || pendingRef.current) return;

    pendingRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const resendType = otpFlowRef.current === "recovery" ? "email_change" as const : "signup" as const;
      const { error: resendError } = await supabase.auth.resend({
        type: resendType,
        email: pendingEmail,
      });

      if (resendError) throw resendError;

      setMessage("New code sent! Check your email.");
      setResendCooldown(60);
      resetOtp();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resend code";
      setError(errorMessage);
    } finally {
      setLoading(false);
      pendingRef.current = false;
    }
  }, [resendCooldown, pendingEmail, resetOtp]);

  // ---- public API ----

  const state: AuthFlowState = {
    isLogin,
    step,
    emailOrUsername,
    password,
    username,
    displayName,
    otpCode,
    pendingEmail,
    resendCooldown,
    loading,
    error,
    message,
  };

  const actions: AuthFlowActions = {
    setIsLogin,
    setStep,
    setEmailOrUsername,
    setPassword,
    setUsername,
    setDisplayName,
    setOtpCode,
    setError,
    setMessage,
    handleCredentialsSubmit,
    handleOtpSubmit,
    handleResendCode,
    handleBackToCredentials,
    toggleMode,
    resetForm,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    tickResendCooldown,
  };

  return { state, actions };
}
