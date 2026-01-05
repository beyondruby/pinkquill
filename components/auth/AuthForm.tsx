"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faArrowRight,
  faEye,
  faEyeSlash,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        let loginEmail = emailOrUsername;

        // Check if input is a username (no @ symbol)
        if (!emailOrUsername.includes("@")) {
          // Look up email by username from profiles table
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .eq("username", emailOrUsername.toLowerCase().replace("@", ""))
            .single();

          if (profileError || !profile?.email) {
            throw new Error("Username not found");
          }

          loginEmail = profile.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) throw error;
        window.location.href = "/";
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

        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              username: username.toLowerCase(),
              display_name: displayName,
              email: emailOrUsername.toLowerCase(),
              avatar_url: '/defaultprofile.png',
            });

          if (profileError) {
            console.log("Profile will be created after email confirmation:", profileError.message);
          }
        }

        setMessage("Check your email to confirm your account!");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FDFCFD] p-4 sm:p-6 lg:p-8 overflow-hidden relative selection:bg-purple-primary/20 selection:text-purple-primary">
      
      {/* Background Ambience - Preserving your brand colors */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-transparent blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-orange-warm/10 via-pink-vivid/5 to-transparent blur-[100px] opacity-50" />
      </div>

      {/* Main Container - The "Floating Manuscript" */}
      <div className="relative z-10 w-full max-w-[1100px] bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/50 flex flex-col lg:flex-row overflow-hidden min-h-[650px]">
        
        {/* LEFT PANEL: The Art (Desktop Only) */}
        <div className="hidden lg:flex w-5/12 relative flex-col justify-between p-12 overflow-hidden">
          
          {/* Abstract Art Layer */}
          <div className="absolute inset-0 z-0 bg-[#faf8fc]">
             {/* Dynamic Shapes */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-purple-primary/20 via-pink-vivid/20 to-orange-warm/20 blur-[60px] rounded-full translate-x-1/3 -translate-y-1/4" />
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-purple-primary/10 to-transparent blur-[80px] rounded-full -translate-x-1/4 translate-y-1/4" />
             
             {/* The "Grain" Overlay for paper texture feel */}
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
              Where words <br />
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm">
                become art
              </span> <br />
              and art finds voice.
            </h2>
            <p className="font-body text-muted text-sm leading-relaxed max-w-xs text-center">
              A home for poets, writers, and creators to share their craft with a community that truly listens.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL: The Form */}
        <div className="w-full lg:w-7/12 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white/50 relative">
          
          {/* Mobile Header (Only visible on small screens) */}
          <div className="lg:hidden mb-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white">
                 <FontAwesomeIcon icon={faFeatherPointed} className="w-3 h-3" />
               </div>
               <span className="font-display text-xl text-ink">PinkQuill</span>
            </Link>
          </div>

          <div className="max-w-md mx-auto w-full">
            <div className="text-left mb-8">
              <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
                {isLogin ? "Welcome back" : "Create account"}
              </h1>
              <p className="font-body text-muted">
                {isLogin ? "Resume your creative journey." : "Join the creative ether today."}
              </p>
            </div>

            
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@poet"
                      required={!isLogin}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      required={!isLogin}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                 <label className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">{isLogin ? "Email or Username" : "Email"}</label>
                <input
                  type={isLogin ? "text" : "email"}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder={isLogin ? "Email or username" : "Email"}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                />
              </div>

              <div className="relative space-y-1">
                <label className="text-[0.65rem] uppercase tracking-wider font-bold text-muted ml-1">Password</label>
                <div className="relative">
                    <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-gray-50/50 border border-gray-200 font-ui text-sm text-ink placeholder-muted/40 outline-none focus:border-purple-primary focus:bg-white focus:ring-4 focus:ring-purple-primary/5 transition-all duration-300"
                    />
                    <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/40 hover:text-purple-primary transition-colors p-1"
                    >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                    </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" className="font-ui text-xs font-medium text-muted hover:text-purple-primary transition-colors">
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
                  onClick={toggleMode}
                  className="ml-1.5 font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-80 transition-opacity"
                >
                  {isLogin ? "Create account" : "Sign in"}
                </button>
              </p>
            </div>
            
            <div className="mt-8 flex justify-center gap-6">
                <Link href="/terms" className="text-xs text-muted/50 hover:text-purple-primary transition-colors">Terms</Link>
                <Link href="/privacy" className="text-xs text-muted/50 hover:text-purple-primary transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}