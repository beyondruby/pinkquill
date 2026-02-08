"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useUpdateCommunity } from "@/lib/hooks";

export default function CommunityChatSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, refetch } = useCommunity(slug, user?.id);
  const { update, updating, error } = useUpdateCommunity();

  const [welcomeMessageDraft, setWelcomeMessageDraft] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!community) return null;

  const welcomeMessage = welcomeMessageDraft ?? (community.welcome_message || "");

  const isAdmin = community.user_role === "admin";
  const isMod = community.user_role === "moderator";

  if (!isAdmin && !isMod) {
    router.push(`/community/${slug}`);
    return null;
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccess(false);

    const result = await update(community.id, {
      welcome_message: welcomeMessage.trim() || null,
    });

    if (!result.success) return;

    setSuccess(true);
    setWelcomeMessageDraft(null);
    refetch();
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-ink">Community Chat Settings</h2>
        <p className="mt-1 font-body text-sm text-muted">
          Configure chat behavior for members and moderators.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-black/5 bg-white p-4">
        <h3 className="font-ui text-sm font-semibold text-ink mb-2">Thread structure</h3>
        <p className="font-body text-sm text-muted">
          Staff can use the <span className="font-semibold text-ink">General</span> thread to
          message all members, and open individual member threads for direct moderation chats.
        </p>
        <Link
          href={`/messages/community?community=${community.slug}`}
          className="inline-flex mt-3 px-3 py-1.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-xs font-ui text-ink transition-colors"
        >
          Open Community Inbox
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-black/5 bg-white p-5">
        <div>
          <label className="block font-ui text-sm font-medium text-ink mb-2">
            Welcome Message
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(event) => setWelcomeMessageDraft(event.target.value)}
            rows={4}
            placeholder="This message is sent when a new member joins."
            className="w-full px-4 py-3 rounded-xl bg-white border border-black/5 font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 transition-all resize-none"
            maxLength={1000}
          />
          <p className="mt-1 font-ui text-xs text-muted text-right">
            {welcomeMessage.length}/1000
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 font-ui text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-ui text-sm">
            Chat settings saved.
          </div>
        )}

        <button
          type="submit"
          disabled={updating}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
        >
          {updating && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Save Chat Settings
        </button>
      </form>
    </div>
  );
}
