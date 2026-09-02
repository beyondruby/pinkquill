"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { safeResponseJson } from "@/lib/utils/fetch";
import { PASSWORD_MIN_LENGTH, validatePasswordStrength } from "@/lib/auth/constants";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import Button from "@/components/ui/Button";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Did the user arrive here via a password-reset recovery link?
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);

  // Check for email confirmation status from callback
  useEffect(() => {
    const error = searchParams.get("error");
    const confirmed = searchParams.get("confirmed");
    const reset = searchParams.get("reset");

    if (error === "email_confirmation_failed") {
      setEmailError("Email confirmation failed. Please try again.");
    }

    if (reset === "true") {
      setIsRecoveryFlow(true);
    }

    // Clear the URL params after reading them
    if (error || confirmed || reset) {
      window.history.replaceState({}, "", "/settings/account");
    }
  }, [searchParams]);

  // Email change state
  const [newEmail, setNewEmail] = useState("");
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !currentPasswordForEmail) return;

    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(false);

    try {
      // Re-auth + request the change via the server route. The new address
      // must be confirmed by email before it takes effect.
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: await buildAuthenticatedHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          email: newEmail,
          currentPassword: currentPasswordForEmail,
        }),
      });

      if (!response.ok) {
        const data = await safeResponseJson<{ error?: string }>(response);
        setEmailError(data.error || "Failed to update email");
        return;
      }

      setEmailSuccess(true);
      setNewEmail("");
      setCurrentPasswordForEmail("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update email";
      setEmailError(errorMessage);
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword || (!isRecoveryFlow && !currentPassword)) {
      setPasswordError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      setPasswordError(strength.error ?? "Password is not strong enough");
      return;
    }

    if (!isRecoveryFlow && currentPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      // Update via /api/auth/change-password. This does the password update
      // server-side via the admin API, so it works regardless of whether the
      // browser SDK still has a usable session in localStorage (a recurring
      // pain point with supabase.auth.updateUser() — it throws "Auth session
      // missing!" whenever the client session drifts from the cookie session).
      //
      // Recovery flow: omit currentPassword — the user authenticated via the
      // email link and may not remember the old one.
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: await buildAuthenticatedHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          password: newPassword,
          ...(isRecoveryFlow ? {} : { currentPassword }),
        }),
      });

      if (!response.ok) {
        const data = await safeResponseJson<{ error?: string }>(response);
        setPasswordError(data.error || "Failed to update password");
        return;
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsRecoveryFlow(false);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update password";
      setPasswordError(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    if (deleteConfirmation.trim() !== "DELETE") {
      setDeleteError('Type "DELETE" to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: await buildAuthenticatedHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ confirmation: deleteConfirmation.trim() }),
      });

      const data = await safeResponseJson<{ success?: boolean; error?: string }>(
        response
      );

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete account");
      }

      // Sign out locally. Even if signOut fails (e.g. network issue),
      // the account is already deleted server-side, so redirect anyway.
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.warn("Sign-out after account deletion failed:", signOutError.message);
        }
      } catch (signOutErr) {
        console.warn("Sign-out after account deletion threw:", signOutErr);
      } finally {
        // Always redirect even if signout fails - account is deleted
        window.location.replace("/");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete account";
      setDeleteError(errorMessage);
      setDeleteLoading(false);
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
              className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
          </div>

          <div>
            <label className="block font-ui text-sm text-ink mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPasswordForEmail}
              onChange={(e) => {
                setCurrentPasswordForEmail(e.target.value);
                setEmailError(null);
                setEmailSuccess(false);
              }}
              placeholder="Confirm your current password"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
            <p className="font-body text-xs text-muted/80 mt-1.5">
              We ask for your password to confirm it&apos;s really you.
            </p>
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
                <span className="font-medium">Confirm your new email</span>
              </div>
              <p className="text-green-600/80 text-[0.8rem] ml-7">
                We sent a confirmation link to the new address. Your email changes once you open it.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!newEmail.trim() || !currentPasswordForEmail}
            loading={emailLoading}
            loadingText="Sending..."
          >
            Update Email
          </Button>
        </form>
      </section>

      {/* Divider */}
      <div className="h-px bg-skeleton mb-12" />

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
          {isRecoveryFlow && (
            <div className="p-4 rounded-xl bg-purple-primary/10 border border-purple-primary/20 font-ui text-sm text-purple-primary">
              You arrived via a password reset link. Set a new password below — you don&apos;t need your old one.
            </div>
          )}

          {!isRecoveryFlow && (
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
                className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
              />
            </div>
          )}

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
              minLength={PASSWORD_MIN_LENGTH}
              className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
            <PasswordStrengthMeter password={newPassword} />
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
              className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all"
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

          <Button
            type="submit"
            disabled={!newPassword || !confirmPassword || (!isRecoveryFlow && !currentPassword)}
            loading={passwordLoading}
            loadingText="Updating..."
          >
            Update Password
          </Button>
        </form>
      </section>

      {/* Danger Zone */}
      <div className="mt-16 p-6 rounded-xl border border-red-200 bg-red-50/50">
        <h3 className="font-ui text-lg text-red-600 mb-2">Danger Zone</h3>
        <p className="font-body text-sm text-red-600/70 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        {!showDeleteConfirm ? (
          <button
            className="px-6 py-2.5 bg-surface border border-red-300 text-red-600 font-ui text-sm font-medium rounded-xl hover:bg-red-50 transition-all"
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeleteError(null);
            }}
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-surface p-4">
              <p className="font-ui text-sm text-red-700">
                Type <span className="font-medium">DELETE</span> to permanently remove your account and content.
              </p>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) => {
                  setDeleteConfirmation(event.target.value);
                  if (deleteError) setDeleteError(null);
                }}
                placeholder='Type "DELETE" to confirm'
                className="mt-3 w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-red-200 transition-all"
              />
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-100 text-red-700 font-ui text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                className="px-6 py-2.5 bg-red-600 text-white font-ui text-sm font-medium rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                disabled={deleteLoading}
                onClick={handleDeleteAccount}
              >
                {deleteLoading ? "Deleting..." : "Permanently Delete Account"}
              </button>
              <button
                className="px-6 py-2.5 bg-surface border border-red-300 text-red-600 font-ui text-sm font-medium rounded-xl hover:bg-red-50 transition-all disabled:opacity-50"
                disabled={deleteLoading}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmation("");
                  setDeleteError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
