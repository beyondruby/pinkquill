"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { loginWithIdentifier, signupWithCredentials } from "@/lib/auth-client";
import {
  normalizeUsername,
  validatePasswordStrength,
  validateUsername,
} from "@/lib/auth/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthStep = "credentials" | "otp" | "forgot" | "forgot_sent";

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
  setEmailOrUsername: (v: string) => void;
  setPassword: (v: string) => void;
  setUsername: (v: string) => void;
  setDisplayName: (v: string) => void;
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

  /** Switch to the forgot-password step. */
  goToForgotPassword: () => void;

  /** Submit the forgot-password email. Sends a recovery link via email. */
  handleForgotPasswordSubmit: (e: React.FormEvent) => Promise<void>;

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
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuthFlow(options?: { initialIsLogin?: boolean }) {
  // ---- state ----
  const [isLogin, setIsLogin] = useState(options?.initialIsLogin ?? true);
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

  const goToForgotPassword = useCallback(() => {
    setStep("forgot");
    setError(null);
    setMessage(null);
  }, []);

  const handleForgotPasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (pendingRef.current) return;

      // emailOrUsername may contain a username; only allow email here.
      const email = emailOrUsername.trim();
      if (!email || !email.includes("@")) {
        setError("Please enter the email associated with your account.");
        return;
      }

      pendingRef.current = true;
      setLoading(true);
      setError(null);
      setMessage(null);

      try {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?type=recovery&next=/settings/account`
            : undefined;

        // Supabase returns success regardless of whether the email exists,
        // which is the desired anti-enumeration behaviour. We surface the
        // same generic confirmation either way.
        await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        setStep("forgot_sent");
      } catch {
        // Even on transport errors, present a generic confirmation to avoid
        // disclosing the existence of the email. The user can retry.
        setStep("forgot_sent");
      } finally {
        setLoading(false);
        pendingRef.current = false;
      }
    },
    [emailOrUsername]
  );

  // ---- cooldown ticker ----

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
          // Client-side validation (server validates again — these are
          // shared rules from lib/auth/constants).
          const usernameError = validateUsername(username);
          if (usernameError) {
            throw new Error(usernameError);
          }
          const passwordCheck = validatePasswordStrength(password);
          if (!passwordCheck.valid) {
            throw new Error(passwordCheck.error ?? "Password is not strong enough.");
          }

          const cleanUsername = normalizeUsername(username);

          const result = await signupWithCredentials({
            email: emailOrUsername,
            password,
            username: cleanUsername,
            displayName,
          });

          if (!result.success) {
            throw new Error(result.error || "Unable to create your account right now.");
          }

          otpFlowRef.current = "signup";
          setPendingEmail(result.pendingEmail || emailOrUsername.toLowerCase());
          setResendCooldown(60);
          setStep("otp");
          if (result.message) setMessage(result.message);
          return "otp";
        }
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
      const resendType = otpFlowRef.current === "recovery" ? "email_change" : "signup";

      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, type: resendType }),
      });

      if (response.status === 429) {
        setError("Too many attempts. Please wait a few minutes before requesting another code.");
        return;
      }

      if (!response.ok) {
        setError("Could not resend code. Please try again.");
        return;
      }

      // Server intentionally returns generic success; we mirror that here.
      setMessage("If an unverified account exists for this email, a new code has been sent.");
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

  const state: AuthFlowState = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  const actions: AuthFlowActions = useMemo(
    () => ({
      setEmailOrUsername,
      setPassword,
      setUsername,
      setDisplayName,
      setError,
      setMessage,
      handleCredentialsSubmit,
      handleOtpSubmit,
      handleResendCode,
      handleBackToCredentials,
      goToForgotPassword,
      handleForgotPasswordSubmit,
      toggleMode,
      resetForm,
      handleOtpChange,
      handleOtpKeyDown,
      handleOtpPaste,
    }),
    [
      handleCredentialsSubmit,
      handleOtpSubmit,
      handleResendCode,
      handleBackToCredentials,
      goToForgotPassword,
      handleForgotPasswordSubmit,
      toggleMode,
      resetForm,
      handleOtpChange,
      handleOtpKeyDown,
      handleOtpPaste,
    ]
  );

  return { state, actions };
}
