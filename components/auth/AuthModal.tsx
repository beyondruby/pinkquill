"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useAuthFlow } from "@/lib/hooks/useAuthFlow";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faArrowRight,
  faEye,
  faEyeSlash,
  faSpinner,
  faXmark,
  faEnvelope,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";

export default function AuthModal() {
  const { isOpen, closeModal } = useAuthModal();
  // Modal opens for guests who clicked an interaction — default to signup, not login.
  const { state, actions } = useAuthFlow({ initialIsLogin: false });
  const {
    isLogin, step, emailOrUsername, password, username, displayName,
    otpCode, pendingEmail, resendCooldown, loading, error, message,
  } = state;

  // UI-only state
  const [showPassword, setShowPassword] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleClose = useCallback(() => {
    actions.resetForm();
    setShowPassword(false);
    closeModal();
  }, [actions, closeModal]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

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

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp" && isOpen) {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step, isOpen]);

  const onCredentialsSubmit = async (e: React.FormEvent) => {
    const result = await actions.handleCredentialsSubmit(e);
    if (result === "redirect") {
      handleClose();
      window.location.reload();
    }
  };

  const onOtpSubmit = async (code?: string) => {
    const result = await actions.handleOtpSubmit(code);
    if (result === "redirect") {
      handleClose();
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface rounded-3xl shadow-2xl shadow-purple-primary/20 overflow-hidden animate-scaleIn">

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-skeleton/80 flex items-center justify-center text-muted hover:text-ink hover:bg-black/10 transition-all z-20"
        >
          <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
        </button>

        {/* Decorative aurora (guest conversion hero) */}
        <div className="absolute inset-x-0 top-0 h-52 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,0,127,0.28),transparent_55%),radial-gradient(120%_80%_at_80%_0%,rgba(142,68,173,0.28),transparent_55%),radial-gradient(120%_120%_at_50%_100%,rgba(255,159,67,0.22),transparent_60%)]" />
          <div className="absolute -top-16 -left-10 w-48 h-48 rounded-full bg-pink-vivid/25 blur-3xl" />
          <div className="absolute -top-10 -right-12 w-52 h-52 rounded-full bg-purple-primary/25 blur-3xl" />
        </div>

        <div className="relative p-8 pt-7">
          {/* Header */}
          <div className="text-center mb-6 relative">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-xl shadow-purple-primary/30 ring-4 ring-surface/80 -rotate-3">
              <FontAwesomeIcon icon={faFeatherPointed} className="w-7 h-7 text-white rotate-3" />
            </div>

            {step === "credentials" ? (
              <>
                <h2 className="font-display text-[1.7rem] leading-tight text-ink mb-2 tracking-tight">
                  {isLogin ? (
                    <>Pick up where you <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm">left off</span>.</>
                  ) : (
                    <>Join the <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm">conversation</span>.</>
                  )}
                </h2>
                <p className="font-body text-[0.95rem] text-muted leading-relaxed max-w-xs mx-auto">
                  {isLogin
                    ? "Sign in to keep reading, reacting, and following the people you love."
                    : "Free to join. React, comment, follow creators, and start your own studio in seconds."
                  }
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-[1.7rem] leading-tight text-ink mb-2 tracking-tight">
                  Check your <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm">mail</span>.
                </h2>
                <p className="font-body text-sm text-muted">
                  We slipped a six-digit code under the door for
                </p>
                <p className="font-ui text-sm font-medium text-ink mt-1.5 flex items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 text-purple-primary" />
                  {pendingEmail}
                </p>
              </>
            )}
          </div>

          {/* Credentials Form */}
          {step === "credentials" && (
            <form onSubmit={onCredentialsSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label htmlFor="auth-modal-username" className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">Username</label>
                    <input
                      id="auth-modal-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => actions.setUsername(e.target.value)}
                      placeholder="Username"
                      required={!isLogin}
                      className="w-full px-3 py-2.5 rounded-xl bg-subtle/50 border border-border-light font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-modal-display-name" className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">Full Name</label>
                    <input
                      id="auth-modal-display-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => actions.setDisplayName(e.target.value)}
                      placeholder="Full Name"
                      required={!isLogin}
                      className="w-full px-3 py-2.5 rounded-xl bg-subtle/50 border border-border-light font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-modal-identifier" className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">
                  {isLogin ? "Email or Username" : "Email"}
                </label>
                <input
                  id="auth-modal-identifier"
                  name={isLogin ? "identifier" : "email"}
                  type={isLogin ? "text" : "email"}
                  autoComplete={isLogin ? "username" : "email"}
                  inputMode={isLogin ? undefined : "email"}
                  value={emailOrUsername}
                  onChange={(e) => actions.setEmailOrUsername(e.target.value)}
                  placeholder={isLogin ? "Email or Username" : "Email"}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-subtle/50 border border-border-light font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all"
                />
              </div>

              <div>
                <label htmlFor="auth-modal-password" className="text-[0.6rem] uppercase tracking-wider font-bold text-muted ml-1">Password</label>
                <div className="relative">
                  <input
                    id="auth-modal-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => actions.setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={isLogin ? undefined : PASSWORD_MIN_LENGTH}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl bg-subtle/50 border border-border-light font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/40 hover:text-accent transition-colors"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                  </button>
                </div>
                {!isLogin && <PasswordStrengthMeter password={password} compact />}
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

              {!isLogin && (
                <p className="font-body text-xs text-muted text-center leading-relaxed px-2">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="font-medium text-ink hover:text-accent underline underline-offset-2 transition-colors">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-medium text-ink hover:text-accent underline underline-offset-2 transition-colors">
                    Privacy Policy
                  </Link>
                  .
                </p>
              )}

              <div className="text-center pt-2">
                <p className="font-ui text-sm text-muted">
                  {isLogin ? "First time here?" : "Already in the club?"}
                  <button
                    type="button"
                    onClick={actions.toggleMode}
                    className="ml-1.5 font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-80 transition-opacity"
                  >
                    {isLogin ? "Make a space" : "Sign in"}
                  </button>
                </p>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  onClick={handleClose}
                  className="font-ui text-xs text-muted/60 hover:text-accent transition-colors"
                >
                  Open the full login page →
                </Link>
              </div>
            </form>
          )}

          {/* OTP Form */}
          {step === "otp" && (
            <div className="animate-fadeIn">
              <button
                onClick={actions.handleBackToCredentials}
                className="flex items-center gap-2 text-muted hover:text-accent transition-colors mb-4 group"
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
                    onChange={(e) => actions.handleOtpChange(index, e.target.value, otpInputRefs)}
                    onKeyDown={(e) => actions.handleOtpKeyDown(index, e, otpInputRefs)}
                    onPaste={index === 0 ? (ev) => actions.handleOtpPaste(ev, otpInputRefs) : undefined}
                    disabled={loading}
                    className="w-11 h-13 text-center text-xl font-bold text-ink rounded-xl bg-subtle/50 border-2 border-border-light outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/10 transition-all disabled:opacity-50"
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
                onClick={() => onOtpSubmit()}
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
                  onClick={actions.handleResendCode}
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
