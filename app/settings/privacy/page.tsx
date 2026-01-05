"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBlock } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

interface BlockedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function PrivacySettingsPage() {
  const { user, profile } = useAuth();
  const { getBlockedUsers, unblockUser } = useBlock();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Private account state
  const [isPrivate, setIsPrivate] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(true);

  // Fetch current privacy setting
  useEffect(() => {
    const fetchPrivacySetting = async () => {
      if (!user) return;

      setPrivacyLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("is_private")
        .eq("id", user.id)
        .single();

      setIsPrivate(data?.is_private || false);
      setPrivacyLoading(false);
    };

    fetchPrivacySetting();
  }, [user]);

  // Toggle private account
  const handlePrivacyToggle = async () => {
    if (!user || savingPrivacy) return;

    const newValue = !isPrivate;
    setSavingPrivacy(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: newValue })
        .eq("id", user.id);

      if (error) throw error;

      setIsPrivate(newValue);

      // If switching from private to public, auto-accept all pending requests
      if (!newValue) {
        await supabase
          .from("follows")
          .update({ status: 'accepted' })
          .eq("following_id", user.id)
          .eq("status", 'pending');
      }
    } catch (err) {
      console.error("Failed to update privacy setting:", err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (!user) return;

      setLoading(true);
      const users = await getBlockedUsers(user.id);
      setBlockedUsers(users as unknown as BlockedUser[]);
      setLoading(false);
    };

    fetchBlockedUsers();
  }, [user]);

  const handleUnblock = async (blockedUserId: string) => {
    if (!user) return;

    setUnblockingId(blockedUserId);
    const result = await unblockUser(user.id, blockedUserId);

    if (result.success) {
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedUserId));
    }
    setUnblockingId(null);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="font-display text-2xl text-ink mb-2">Privacy Settings</h2>
        <p className="font-body text-muted">
          Manage your blocked accounts and privacy preferences
        </p>
      </div>

      {/* Account Privacy Section */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-ui text-lg text-ink">Account Privacy</h3>
            <p className="font-body text-sm text-muted">
              Control who can see your profile and posts
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-ui text-[0.95rem] font-medium text-ink">
                  Private Account
                </h4>
                {isPrivate && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-ui text-xs font-medium">
                    Active
                  </span>
                )}
              </div>
              <p className="font-body text-sm text-muted">
                When your account is private, only people you approve can see your posts, stories, and profile information.
              </p>
            </div>

            {privacyLoading ? (
              <div className="w-12 h-7 bg-black/[0.06] rounded-full animate-pulse" />
            ) : (
              <button
                onClick={handlePrivacyToggle}
                disabled={savingPrivacy}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  isPrivate
                    ? "bg-gradient-to-r from-purple-primary to-pink-vivid"
                    : "bg-black/[0.12]"
                } ${savingPrivacy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                    isPrivate ? "left-6" : "left-1"
                  }`}
                />
              </button>
            )}
          </div>

          {isPrivate && (
            <div className="mt-4 pt-4 border-t border-black/[0.06]">
              <div className="flex items-start gap-3 text-sm">
                <svg className="w-5 h-5 text-purple-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="font-body text-muted">
                  <p className="mb-2">With a private account:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Only approved followers can see your posts</li>
                    <li>People must request to follow you</li>
                    <li>Your bio and profile info are hidden from non-followers</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Blocked Users Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h3 className="font-ui text-lg text-ink">Blocked Accounts</h3>
            <p className="font-body text-sm text-muted">
              {blockedUsers.length === 0
                ? "You haven't blocked anyone"
                : `${blockedUsers.length} blocked ${blockedUsers.length === 1 ? 'account' : 'accounts'}`
              }
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="bg-black/[0.02] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-black/[0.04] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p className="font-body text-muted">
              When you block someone, they won't be able to see your profile, posts, or message you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((blockedUser) => (
              <div
                key={blockedUser.id}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-black/[0.04] hover:border-black/[0.08] transition-all"
              >
                <Link
                  href={`/studio/${blockedUser.username}`}
                  className="flex items-center gap-3 flex-1 group"
                >
                  <img
                    src={blockedUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
                    alt={blockedUser.display_name || blockedUser.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-ui text-[0.95rem] font-medium text-ink group-hover:text-purple-primary transition-colors">
                      {blockedUser.display_name || blockedUser.username}
                    </h4>
                    <p className="font-ui text-sm text-muted">
                      @{blockedUser.username}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={() => handleUnblock(blockedUser.id)}
                  disabled={unblockingId === blockedUser.id}
                  className="px-5 py-2 rounded-full border border-black/10 bg-white font-ui text-sm text-ink hover:border-purple-primary hover:text-purple-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unblockingId === blockedUser.id ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
                      Unblocking...
                    </span>
                  ) : (
                    "Unblock"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {blockedUsers.length > 0 && (
          <p className="mt-4 font-body text-xs text-muted">
            Unblocking someone will allow them to see your profile and posts again. They can also follow you and send you messages.
          </p>
        )}
      </section>
    </div>
  );
}
