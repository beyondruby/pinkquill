"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Check for email confirmation status from callback
  useEffect(() => {
    const error = searchParams.get("error");
    const confirmed = searchParams.get("confirmed");

    if (error === "email_confirmation_failed") {
      setEmailError("Email confirmation failed. Please try again.");
    }

    // Clear the URL params after reading them
    if (error || confirmed) {
      window.history.replaceState({}, "", "/settings/account");
    }
  }, [searchParams]);

  // Email change state
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(false);

    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings/account` }
      );

      if (error) throw error;

      setEmailSuccess(true);
      setNewEmail("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update email";
      setEmailError(errorMessage);
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      // First, verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError("Current password is incorrect");
        setPasswordLoading(false);
        return;
      }

      // If current password is correct, update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update password";
      setPasswordError(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="font-display text-2xl text-ink mb-2">Account Settings</h2>
        <p className="font-body text-muted">
          Manage your email address and password
        </p>
      </div>

      {/* Email Section */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-primary/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-ui text-lg text-ink">Email Address</h3>
            <p className="font-body text-sm text-muted">
              Current: {user?.email}
            </p>
          </div>
        </div>

        <form onSubmit={handleEmailChange} className="space-y-4">
          <div>
            <label className="block font-ui text-sm text-ink mb-2">
              New Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError(null);
                setEmailSuccess(false);
              }}
              placeholder="Enter new email address"
              className="w-full px-4 py-3 rounded-xl bg-black/[0.03] border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
          </div>

          {emailError && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 font-ui text-sm">
              {emailError}
            </div>
          )}

          {emailSuccess && (
            <div className="p-4 rounded-xl bg-green-50 text-green-700 font-ui text-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Confirmation email sent!</span>
              </div>
              <p className="text-green-600/80 text-[0.8rem] ml-7">
                Check your new email inbox and click the confirmation link to complete the change.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={emailLoading || !newEmail.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {emailLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              "Update Email"
            )}
          </button>
        </form>
      </section>

      {/* Divider */}
      <div className="h-px bg-black/[0.06] mb-12" />

      {/* Password Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-primary/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-ui text-lg text-ink">Password</h3>
            <p className="font-body text-sm text-muted">
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block font-ui text-sm text-ink mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError(null);
                setPasswordSuccess(false);
              }}
              placeholder="Enter current password"
              className="w-full px-4 py-3 rounded-xl bg-black/[0.03] border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
          </div>

          <div>
            <label className="block font-ui text-sm text-ink mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(null);
                setPasswordSuccess(false);
              }}
              placeholder="Enter new password"
              className="w-full px-4 py-3 rounded-xl bg-black/[0.03] border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
          </div>

          <div>
            <label className="block font-ui text-sm text-ink mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(null);
                setPasswordSuccess(false);
              }}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 rounded-xl bg-black/[0.03] border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 font-ui text-sm">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 rounded-xl bg-green-50 text-green-600 font-ui text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Password updated successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {passwordLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </span>
            ) : (
              "Update Password"
            )}
          </button>
        </form>
      </section>

      {/* Danger Zone */}
      <div className="mt-16 p-6 rounded-xl border border-red-200 bg-red-50/50">
        <h3 className="font-ui text-lg text-red-600 mb-2">Danger Zone</h3>
        <p className="font-body text-sm text-red-600/70 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          className="px-6 py-2.5 bg-white border border-red-300 text-red-600 font-ui text-sm font-medium rounded-xl hover:bg-red-50 transition-all"
          onClick={() => {
            if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
              // TODO: Implement account deletion
              alert("Account deletion is not yet implemented.");
            }
          }}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
