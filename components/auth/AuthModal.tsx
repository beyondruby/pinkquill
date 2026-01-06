"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { supabase } from "@/lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faArrowRight,
  faEye,
  faEyeSlash,
  faSpinner,
  faXmark,
  faEnvelope,
  faShieldHalved,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";

type AuthStep = "credentials" | "otp";

export default function AuthModal() {
  const { isOpen, closeModal } = useAuthModal();
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

  const modalRef = useRef<HTMLDivElement>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeModal();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeModal]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("credentials");
      setEmailOrUsername("");
      setPassword("");
      setUsername("");
      setDisplayName("");
      setOtpCode(["", "", "", "", "", ""]);
      setError(null);
      setMessage(null);
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp" && isOpen) {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step, isOpen]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        let loginEmail = emailOrUsername.trim();

        if (!emailOrUsername.includes("@") || emailOrUsername.startsWith("@")) {
          const normalizedUsername = emailOrUsername.toLowerCase().replace(/^@/, "").trim();

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .eq("username", normalizedUsername)
            .single();

          if (profileError || !profile?.email) {
            throw new Error("Username not found. Please use your email.");
          }
          loginEmail = profile.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) {
          if (error.message.includes("Email not confirmed")) {
            setPendingEmail(loginEmail);
            await supabase.auth.resend({ type: "signup", email: loginEmail });
            setResendCooldown(60);
            setStep("otp");
            setMessage("Please verify your email with the code we sent.");
          } else {
            throw error;
          }
        } else {
          closeModal();
          window.location.reload();
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
            avatar_url: '/defaultprofile.png',
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
              avatar_url: '/defaultprofile.png',
            });
          }
          closeModal();
          window.location.reload();
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newOtp.every(digit => digit !== "")) {
      handleOtpSubmit(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtpCode(newOtp);
      otpInputRefs.current[5]?.focus();
      handleOtpSubmit(pastedData);
    }
  };

  const handleOtpSubmit = async (code?: string) => {
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
        closeModal();
        window.location.reload();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Verification failed";
      setError(errorMessage);
      setOtpCode(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
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

      setMessage("New code sent!");
      setResendCooldown(60);
      setOtpCode(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resend code";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={closeModal}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-purple-primary/10 border border-white/50 overflow-hidden animate-scaleIn"
      >
        {/* Close button */}
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-muted hover:text-ink hover:bg-black/10 transition-all z-10"
        >
          <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
        </button>

        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 pointer-events-none" />

        <div className="relative p-8 pt-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-lg shadow-purple-primary/20">
              <FontAwesomeIcon icon={faFeatherPointed} className="w-6 h-6 text-white" />
            </div>

            {step === "credentials" ? (
              <>
                <h2 className="font-display text-2xl text-ink mb-2">
                  {isLogin ? "Welcome Back" : "Create Your Space"}
                </h2>
                <p className="font-body text-sm text-muted leading-relaxed max-w-xs mx-auto">
                  {isLogin
                    ? "Sign in to like, comment, and share your creative voice."
                    : "Join our community of poets, writers, and dreamers."
                  }
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl text-ink mb-2">
                  Check Your Inbox
                </h2>
                <p className="font-body text-sm text-muted">
                  Enter the 6-digit code sent to
                </p>
                <p className="font-ui text-sm font-medium text-ink mt-1 flex items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 text-purple-primary" />
                  {pendingEmail}
                </p>
              </>
            )}
          </div>

          {/* Credentials Form */}
          {step === "credentials" && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@poet"
                      required={!isLogin}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      required={!isLogin}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">
                  {isLogin ? "Email or Username" : "Email"}
                </label>
                <input
                  type={isLogin ? "text" : "email"}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder={isLogin ? "Email or username" : "your@email.com"}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all"
                />
              </div>

              <div>
                <label className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/40 hover:text-purple-primary transition-colors"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50/80 border border-red-100 text-red-600 font-ui text-xs">
                  {error}
                </div>
              )}

              {message && (
                <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-100 text-emerald-600 font-ui text-xs">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-[length:200%_auto] hover:bg-[position:right_center] transition-all duration-500 shadow-lg shadow-purple-primary/20 disabled:opacity-70 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin w-4 h-4" />
                    <span className="text-sm">Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">{isLogin ? "Sign In" : "Create Account"}</span>
                    <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="font-ui text-sm text-muted">
                  {isLogin ? "New here?" : "Already a member?"}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                      setMessage(null);
                    }}
                    className="ml-1.5 font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-80 transition-opacity"
                  >
                    {isLogin ? "Create account" : "Sign in"}
                  </button>
                </p>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  onClick={closeModal}
                  className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors"
                >
                  Go to full login page
                </Link>
              </div>
            </form>
          )}

          {/* OTP Form */}
          {step === "otp" && (
            <div className="animate-fadeIn">
              <button
                onClick={() => {
                  setStep("credentials");
                  setOtpCode(["", "", "", "", "", ""]);
                  setError(null);
                  setMessage(null);
                }}
                className="flex items-center gap-2 text-muted hover:text-purple-primary transition-colors mb-4 group"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                <span className="font-ui text-xs">Back</span>
              </button>

              <div className="flex justify-center gap-2 mb-4">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    disabled={loading}
                    className="w-11 h-13 text-center text-xl font-bold text-ink rounded-xl bg-gray-50/50 border-2 border-gray-200 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/10 transition-all disabled:opacity-50"
                  />
                ))}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50/80 border border-red-100 text-red-600 font-ui text-xs text-center mb-4">
                  {error}
                </div>
              )}

              {message && (
                <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-100 text-emerald-600 font-ui text-xs text-center mb-4">
                  {message}
                </div>
              )}

              <button
                onClick={() => handleOtpSubmit()}
                disabled={loading || otpCode.some(d => d === "")}
                className="w-full py-3 rounded-xl font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-[length:200%_auto] hover:bg-[position:right_center] transition-all duration-500 shadow-lg shadow-purple-primary/20 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin w-4 h-4" />
                    <span className="text-sm">Verifying...</span>
                  </>
                ) : (
                  <span className="text-sm">Verify Code</span>
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || loading}
                  className={`font-ui text-sm transition-all ${
                    resendCooldown > 0
                      ? "text-muted cursor-not-allowed"
                      : "text-purple-primary hover:opacity-80"
                  }`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
