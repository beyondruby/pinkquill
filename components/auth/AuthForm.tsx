"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthFlow } from "@/lib/hooks/useAuthFlow";
import { getSafeRedirectPath } from "@/lib/utils/redirect";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faArrowRight,
  faArrowLeft,
  faEye,
  faEyeSlash,
  faSpinner,
  faEnvelope,
  faShieldHalved
} from "@fortawesome/free-solid-svg-icons";

export default function AuthForm() {
  const { state, actions } = useAuthFlow();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get("redirect"));
  const {
    isLogin, step, emailOrUsername, password, username, displayName,
    otpCode, pendingEmail, resendCooldown, loading, error, message,
  } = state;

  // showPassword is UI-only, not shared auth logic
  const [showPassword, setShowPassword] = useState(false);

  // Refs for OTP inputs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const onCredentialsSubmit = async (e: React.FormEvent) => {
    const result = await actions.handleCredentialsSubmit(e);
    if (result === "redirect") {
      window.location.href = redirectTarget;
    }
  };

  const onOtpSubmit = async (code?: string) => {
    const result = await actions.handleOtpSubmit(code);
    if (result === "redirect") {
      window.location.href = redirectTarget;
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FDFCFD] p-4 sm:p-6 lg:p-8 overflow-hidden relative selection:bg-purple-primary/20 selection:text-purple-primary">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-transparent blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-orange-warm/10 via-pink-vivid/5 to-transparent blur-[100px] opacity-50" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[1100px] bg-surface/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/50 flex flex-col lg:flex-row overflow-hidden min-h-[650px]">

        {/* LEFT PANEL: The Art (Desktop Only) */}
        <div className="hidden lg:flex w-5/12 relative flex-col justify-between p-12 overflow-hidden">

          {/* Abstract Art Layer */}
          <div className="absolute inset-0 z-0 bg-[#faf8fc]">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-purple-primary/20 via-pink-vivid/20 to-orange-warm/20 blur-[60px] rounded-full translate-x-1/3 -translate-y-1/4" />
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-purple-primary/10 to-transparent blur-[80px] rounded-full -translate-x-1/4 translate-y-1/4" />
             <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
          </div>

          {/* Branding Content */}
          <div className="relative z-10">
            <Link href="/" className="flex items-center gap-3 w-fit">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-lg shadow-purple-primary/20">
                <FontAwesomeIcon icon={faFeatherPointed} className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl text-ink">PinkQuill</h1>
                <p className="font-body text-[0.65rem] text-muted italic">The Creative Ether</p>
              </div>
            </Link>
          </div>

          <div className="relative z-10 my-auto flex flex-col items-center">
            <h2 className="font-display text-4xl leading-[1.2] text-ink mb-6 text-center">
              Where creativity <br />
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm">
                has no limits
              </span> <br />
              and every voice matters.
            </h2>
            <p className="font-body text-muted text-sm leading-relaxed max-w-xs text-center">
              The platform built for creatives. Share your art, grow your audience, and connect with a community that gets it.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL: The Form */}
        <div className="w-full lg:w-7/12 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-surface/50 relative">

          {/* Mobile Header */}
          <div className="lg:hidden mb-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white">
                 <FontAwesomeIcon icon={faFeatherPointed} className="w-3 h-3" />
               </div>
               <span className="font-display text-xl text-ink">PinkQuill</span>
            </Link>
          </div>

          <div className="max-w-md mx-auto w-full">

            {/* STEP 1: Credentials Form */}
            {step === "credentials" && (
              <>
                <div className="text-left mb-8">
                  <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
                    {isLogin ? "Welcome back" : "Create account"}
                  </h1>
                  <p className="font-body text-muted">
                    {isLogin ? "Your creative world awaits." : "Start creating with us today."}
                  </p>
                </div>

                <form onSubmit={onCredentialsSubmit} className="space-y-5">
                  {!isLogin && (
                    <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                      <div className="space-y-1">
                        <label htmlFor="auth-form-username" className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">Username</label>
                        <input
                          id="auth-form-username"
                          type="text"
                          value={username}
                          onChange={(e) => actions.setUsername(e.target.value)}
                          placeholder="@yourname"
                          required={!isLogin}
                          className="w-full px-4 py-3 rounded-xl bg-subtle/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="auth-form-display-name" className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">Display Name</label>
                        <input
                          id="auth-form-display-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => actions.setDisplayName(e.target.value)}
                          placeholder="Jane Doe"
                          required={!isLogin}
                          className="w-full px-4 py-3 rounded-xl bg-subtle/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="auth-form-identifier" className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">
                      {isLogin ? "Email or Username" : "Email"}
                    </label>
                    <input
                      id="auth-form-identifier"
                      type={isLogin ? "text" : "email"}
                      value={emailOrUsername}
                      onChange={(e) => actions.setEmailOrUsername(e.target.value)}
                      placeholder={isLogin ? "Email or username" : "Email"}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-subtle/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                    />
                  </div>

                  <div className="relative space-y-1">
                    <label htmlFor="auth-form-password" className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">Password</label>
                    <div className="relative">
                      <input
                        id="auth-form-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => actions.setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={isLogin ? undefined : PASSWORD_MIN_LENGTH}
                        className="w-full px-4 py-3 pr-11 rounded-xl bg-subtle/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/40 hover:text-accent transition-colors p-1"
                      >
                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                      </button>
                    </div>
                    {!isLogin && <PasswordStrengthMeter password={password} />}
                  </div>

                  {isLogin && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={actions.goToForgotPassword}
                        className="font-ui text-xs font-medium text-muted hover:text-accent transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50/80 border border-red-100 text-red-600 font-ui text-xs backdrop-blur-sm">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-100 text-emerald-600 font-ui text-xs backdrop-blur-sm">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-[length:200%_auto] hover:bg-[position:right_center] transition-all duration-500 shadow-lg shadow-purple-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group transform active:scale-[0.98]"
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
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                  <p className="font-ui text-sm text-muted">
                    {isLogin ? "New to PinkQuill?" : "Already a member?"}
                    <button
                      onClick={actions.toggleMode}
                      className="ml-1.5 font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-80 transition-opacity"
                    >
                      {isLogin ? "Create account" : "Sign in"}
                    </button>
                  </p>
                </div>
              </>
            )}

            {/* STEP 2: OTP Verification */}
            {step === "otp" && (
              <div className="animate-fadeIn">
                {/* Back Button */}
                <button
                  onClick={actions.handleBackToCredentials}
                  className="flex items-center gap-2 text-muted hover:text-accent transition-colors mb-6 group"
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="font-ui text-sm">Back</span>
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                    <FontAwesomeIcon icon={faShieldHalved} className="w-7 h-7 text-purple-primary" />
                  </div>
                  <h1 className="font-display text-3xl text-ink mb-3">
                    Verify your email
                  </h1>
                  <p className="font-body text-muted text-sm">
                    Enter the 6-digit code sent to
                  </p>
                  <p className="font-ui text-sm font-medium text-ink mt-1 flex items-center justify-center gap-2">
                    <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4 text-purple-primary" />
                    {pendingEmail}
                  </p>
                </div>

                {/* OTP Input */}
                <div className="flex justify-center gap-2 sm:gap-3 mb-6">
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
                      onPaste={index === 0 ? (e) => actions.handleOtpPaste(e, otpInputRefs) : undefined}
                      disabled={loading}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold text-ink rounded-xl bg-subtle/50 border-2 border-gray-200 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/10 transition-all duration-200 disabled:opacity-50"
                    />
                  ))}
                </div>

                {/* Error/Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50/80 border border-red-100 text-red-600 font-ui text-xs backdrop-blur-sm text-center mb-4">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-100 text-emerald-600 font-ui text-xs backdrop-blur-sm text-center mb-4">
                    {message}
                  </div>
                )}

                {/* Verify Button */}
                <button
                  onClick={() => onOtpSubmit()}
                  disabled={loading || otpCode.some(d => d === "")}
                  className="w-full py-3.5 rounded-xl font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-[length:200%_auto] hover:bg-[position:right_center] transition-all duration-500 shadow-lg shadow-purple-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98]"
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

                {/* Resend Code */}
                <div className="mt-6 text-center">
                  <p className="font-ui text-sm text-muted mb-2">
                    Didn&apos;t receive the code?
                  </p>
                  <button
                    onClick={actions.handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    className={`font-ui text-sm font-semibold transition-all ${
                      resendCooldown > 0
                        ? "text-muted cursor-not-allowed"
                        : "text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-80"
                    }`}
                  >
                    {resendCooldown > 0 ? (
                      <>Resend in {resendCooldown}s</>
                    ) : (
                      "Resend Code"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Forgot Password — request reset link */}
            {step === "forgot" && (
              <div className="animate-fadeIn">
                <button
                  onClick={actions.handleBackToCredentials}
                  className="flex items-center gap-2 text-muted hover:text-accent transition-colors mb-6 group"
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="font-ui text-sm">Back to sign in</span>
                </button>

                <div className="text-left mb-8">
                  <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">Reset your password</h1>
                  <p className="font-body text-muted">
                    Enter your account email and we&apos;ll send you a link to set a new password.
                  </p>
                </div>

                <form onSubmit={actions.handleForgotPasswordSubmit} className="space-y-5">
                  <div className="space-y-1">
                    <label htmlFor="auth-form-forgot-email" className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">
                      Email
                    </label>
                    <input
                      id="auth-form-forgot-email"
                      type="email"
                      value={emailOrUsername}
                      onChange={(e) => actions.setEmailOrUsername(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-subtle/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-surface focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50/80 border border-red-100 text-red-600 font-ui text-xs">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-[length:200%_auto] hover:bg-[position:right_center] transition-all duration-500 shadow-lg shadow-purple-primary/20 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin w-4 h-4" />
                        <span className="text-sm">Sending...</span>
                      </>
                    ) : (
                      <span className="text-sm">Send reset link</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* STEP 4: Forgot Password — confirmation */}
            {step === "forgot_sent" && (
              <div className="animate-fadeIn text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                  <FontAwesomeIcon icon={faEnvelope} className="w-7 h-7 text-purple-primary" />
                </div>
                <h1 className="font-display text-3xl text-ink mb-3">Check your email</h1>
                <p className="font-body text-muted text-sm mb-8">
                  If an account exists for <span className="font-medium text-ink">{emailOrUsername}</span>, a password reset link is on its way. Follow the link to set a new password.
                </p>
                <button
                  onClick={actions.handleBackToCredentials}
                  className="font-ui text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-80"
                >
                  Back to sign in
                </button>
              </div>
            )}

            <div className="mt-8 flex justify-center gap-6">
              <Link href="/terms" className="text-xs text-muted hover:text-accent transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-muted hover:text-accent transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
