import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { loginWithIdentifier } from "@/lib/auth-client";

export type AuthStep = "credentials" | "otp";

export interface UseAuthFlowOptions {
  /** Called after successful login or OTP verification */
  onSuccess: () => void;
}

export interface UseAuthFlowReturn {
  // Auth mode
  isLogin: boolean;
  setIsLogin: (v: boolean) => void;
  step: AuthStep;

  // Credential fields
  emailOrUsername: string;
  setEmailOrUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;

  // OTP fields
  otpCode: string[];
  pendingEmail: string;
  resendCooldown: number;
  otpInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;

  // UI state
  loading: boolean;
  error: string | null;
  message: string | null;

  // Handlers
  handleCredentialsSubmit: (e: React.FormEvent) => Promise<void>;
  handleOtpChange: (index: number, value: string) => void;
  handleOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleOtpPaste: (e: React.ClipboardEvent) => void;
  handleOtpSubmit: (code?: string) => Promise<void>;
  handleResendCode: () => Promise<void>;
  handleBackToCredentials: () => void;
  toggleMode: () => void;
  resetForm: () => void;
}

export function useAuthFlow({ onSuccess }: UseAuthFlowOptions): UseAuthFlowReturn {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>("credentials");

  // Credentials state
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Stable ref for onSuccess to avoid re-creating handlers
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const resetForm = useCallback(() => {
    setStep("credentials");
    setEmailOrUsername("");
    setPassword("");
    setUsername("");
    setDisplayName("");
    setShowPassword(false);
    setOtpCode(["", "", "", "", "", ""]);
    setPendingEmail("");
    setError(null);
    setMessage(null);
  }, []);

  const handleBackToCredentials = useCallback(() => {
    setStep("credentials");
    setOtpCode(["", "", "", "", "", ""]);
    setError(null);
    setMessage(null);
  }, []);

  const toggleMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setStep("credentials");
    setError(null);
    setMessage(null);
    setOtpCode(["", "", "", "", "", ""]);
  }, []);

  const handleOtpSubmit = useCallback(async (code?: string) => {
    const otpString = code || otpCode.join("");
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otpString,
        type: "signup",
      });

      if (error) {
        if (error.message.includes("Token has expired") || error.message.includes("invalid")) {
          setError("Invalid or expired code. Please try again.");
        } else {
          setError(error.message);
        }
        setOtpCode(["", "", "", "", "", ""]);
        otpInputRefs.current[0]?.focus();
        return;
      }

      if (data.user) {
        onSuccessRef.current();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Verification failed";
      setError(errorMessage);
      setOtpCode(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [otpCode, pendingEmail]);

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    setOtpCode((prev) => {
      const newOtp = [...prev];
      newOtp[index] = value;

      // Auto-focus next input
      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all 6 digits are entered
      if (value && index === 5 && newOtp.every((digit) => digit !== "")) {
        handleOtpSubmit(newOtp.join(""));
      }

      return newOtp;
    });
  }, [handleOtpSubmit]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }, [otpCode]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtpCode(newOtp);
      otpInputRefs.current[5]?.focus();
      handleOtpSubmit(pastedData);
    }
  }, [handleOtpSubmit]);

  const handleResendCode = useCallback(async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
      });

      if (error) throw error;

      setMessage("New code sent! Check your email.");
      setResendCooldown(60);
      setOtpCode(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resend code";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [resendCooldown, pendingEmail]);

  const handleCredentialsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const result = await loginWithIdentifier(emailOrUsername, password);

        if (!result.success) {
          if (result.requiresVerification && result.pendingEmail) {
            setPendingEmail(result.pendingEmail);
            setResendCooldown(60);
            setStep("otp");
            setMessage(result.message || "Please verify your email with the code we sent.");
          } else {
            throw new Error(result.error || "Unable to sign in right now.");
          }
        } else {
          onSuccessRef.current();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailOrUsername,
          password,
          options: {
            data: {
              username: username.toLowerCase(),
              display_name: displayName,
            },
          },
        });

        if (error) throw error;

        if (data.user?.identities?.length === 0) {
          throw new Error("An account with this email already exists.");
        }

        const needsEmailConfirmation = !data.session;

        if (data.user && needsEmailConfirmation) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            username: username.toLowerCase(),
            display_name: displayName,
            email: emailOrUsername.toLowerCase(),
            avatar_url: "/defaultprofile.png",
          });

          setPendingEmail(emailOrUsername);
          setResendCooldown(60);
          setStep("otp");
        } else if (data.session) {
          if (data.user) {
            await supabase.from("profiles").insert({
              id: data.user.id,
              username: username.toLowerCase(),
              display_name: displayName,
              email: emailOrUsername.toLowerCase(),
              avatar_url: "/defaultprofile.png",
            });
          }
          onSuccessRef.current();
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLogin, emailOrUsername, password, username, displayName]);

  return {
    isLogin,
    setIsLogin,
    step,
    emailOrUsername,
    setEmailOrUsername,
    password,
    setPassword,
    username,
    setUsername,
    displayName,
    setDisplayName,
    showPassword,
    setShowPassword,
    otpCode,
    pendingEmail,
    resendCooldown,
    otpInputRefs,
    loading,
    error,
    message,
    handleCredentialsSubmit,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    handleOtpSubmit,
    handleResendCode,
    handleBackToCredentials,
    toggleMode,
    resetForm,
  };
}
