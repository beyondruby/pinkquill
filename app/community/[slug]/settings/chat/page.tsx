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
  const [communityChatEnabledDraft, setCommunityChatEnabledDraft] = useState<boolean | null>(null);
  const [allowMemberMessagesDraft, setAllowMemberMessagesDraft] = useState<boolean | null>(null);
  const [allowModmailDraft, setAllowModmailDraft] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);

  if (!community) return null;

  const isAdmin = community.user_role === "admin";
  const isMod = community.user_role === "moderator";
  const canManageWelcome = isAdmin || isMod;
  const canManageToggles = isAdmin;

  const welcomeMessage = welcomeMessageDraft ?? (community.welcome_message || "");
  const communityChatEnabled =
    communityChatEnabledDraft ?? (community.community_chat_enabled !== false);
  const allowMemberMessages =
    allowMemberMessagesDraft ?? (community.community_chat_allow_member_messages !== false);
  const allowModmail =
    allowModmailDraft ?? (community.community_chat_allow_modmail !== false);

  if (!canManageWelcome) {
    router.push(`/community/${slug}`);
    return null;
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccess(false);

    const payload: {
      welcome_message?: string | null;
      community_chat_enabled?: boolean;
      community_chat_allow_member_messages?: boolean;
      community_chat_allow_modmail?: boolean;
    } = {};

    if (canManageWelcome) {
      payload.welcome_message = welcomeMessage.trim() || null;
    }

    if (canManageToggles) {
      payload.community_chat_enabled = communityChatEnabled;
      payload.community_chat_allow_member_messages = allowMemberMessages;
      payload.community_chat_allow_modmail = allowModmail;
    }

    const result = await update(community.id, payload);
    if (!result.success) return;

    setSuccess(true);
    refetch();
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-ink">Community Chat Settings</h2>
        <p className="mt-1 font-body text-sm text-muted">
          Configure community chat behavior, moderation inbox access, and welcome messaging.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-border-light bg-surface p-4">
        <h3 className="font-ui text-sm font-semibold text-ink mb-2">Thread structure</h3>
        <p className="font-body text-sm text-muted">
          Staff use the <span className="font-semibold text-ink">General</span> thread for
          community-wide updates, and can open direct member threads from search when needed.
        </p>
        <Link
          href={`/messages/community?community=${community.slug}`}
          className="inline-flex mt-3 px-3 py-1.5 rounded-full bg-skeleton/70 hover:bg-skeleton text-xs font-ui text-ink transition-colors"
        >
          Open Community Inbox
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-border-light bg-surface p-5">
        <div className="space-y-3">
          <h3 className="font-ui text-sm font-semibold text-ink">Chat Controls</h3>

          <button
            type="button"
            disabled={!canManageToggles}
            onClick={() =>
              setCommunityChatEnabledDraft((prev) =>
                prev === null ? !communityChatEnabled : !prev
              )
            }
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              communityChatEnabled
                ? "bg-emerald-50 border-emerald-200"
                : "bg-subtle border-border-light"
            } ${!canManageToggles ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div>
              <p className="font-ui text-sm font-medium text-ink">Enable Community Chat</p>
              <p className="font-body text-xs text-muted mt-1">
                Turn community chat on or off for the entire community.
              </p>
            </div>
            <span className="font-ui text-xs font-semibold uppercase text-ink">
              {communityChatEnabled ? "On" : "Off"}
            </span>
          </button>

          <button
            type="button"
            disabled={!canManageToggles}
            onClick={() =>
              setAllowMemberMessagesDraft((prev) =>
                prev === null ? !allowMemberMessages : !prev
              )
            }
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              allowMemberMessages
                ? "bg-purple-primary/[0.04] border-purple-primary/15"
                : "bg-subtle border-border-light"
            } ${!canManageToggles ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div>
              <p className="font-ui text-sm font-medium text-ink">
                Allow All Members To Send Messages In Community Chat
              </p>
              <p className="font-body text-xs text-muted mt-1">
                Controls whether regular member messages are allowed in chat threads.
              </p>
            </div>
            <span className="font-ui text-xs font-semibold uppercase text-ink">
              {allowMemberMessages ? "On" : "Off"}
            </span>
          </button>

          <button
            type="button"
            disabled={!canManageToggles}
            onClick={() =>
              setAllowModmailDraft((prev) =>
                prev === null ? !allowModmail : !prev
              )
            }
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              allowModmail
                ? "bg-purple-50 border-purple-200"
                : "bg-subtle border-border-light"
            } ${!canManageToggles ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div>
              <p className="font-ui text-sm font-medium text-ink">
                Allow Members To Message The Moderation Team
              </p>
              <p className="font-body text-xs text-muted mt-1">
                Enables direct moderation messages and appeals from members.
              </p>
            </div>
            <span className="font-ui text-xs font-semibold uppercase text-ink">
              {allowModmail ? "On" : "Off"}
            </span>
          </button>

          {!canManageToggles && (
            <p className="font-ui text-xs text-muted">
              Only admins can change chat control toggles.
            </p>
          )}
        </div>

        <div>
          <label className="block font-ui text-sm font-medium text-ink mb-2">
            Welcome Message
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(event) => setWelcomeMessageDraft(event.target.value)}
            rows={4}
            placeholder="This message is sent when a new member joins."
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border-light font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200 transition-all resize-none"
            maxLength={1000}
          />
          <p className="mt-1 font-ui text-xs text-muted text-right">
            {welcomeMessage.length}/1000
          </p>
        </div>

        <div className="rounded-lg bg-skeleton/60 border border-border-light px-3 py-2">
          <p className="font-ui text-xs text-muted">
            Members must be in community chat to participate when chat is enabled.
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
