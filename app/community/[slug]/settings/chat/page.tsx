"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useUpdateCommunity } from "@/lib/hooks.legacy";
import Button from "@/components/ui/Button";
import { FieldLabel, Switch } from "@/components/create/pieces";
import { CommunitySettingsFrame, Notice } from "@/components/communities/pieces";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

export default function CommunityChatSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, refetch } = useCommunity(slug, user?.id);

  // Role gate: redirect from an effect (a router.push during render is a
  // React error and can loop). The proxy already requires a session; the
  // real authorization lives in RLS and the moderation RPCs.
  useEffect(() => {
    if (community && (community.user_role !== "admin" && community.user_role !== "moderator")) {
      router.replace(`/community/${slug}`);
    }
  }, [community, router, slug]);
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

  const toggles = [
    {
      label: "Community chat",
      description: "A shared thread for everyone in the community, plus threads staff open with members.",
      value: communityChatEnabled,
      set: () => setCommunityChatEnabledDraft((prev) => (prev === null ? !communityChatEnabled : !prev)),
    },
    {
      label: "Members can write in chat",
      description: "Off means only staff post in the shared thread; members still read it.",
      value: allowMemberMessages,
      set: () => setAllowMemberMessagesDraft((prev) => (prev === null ? !allowMemberMessages : !prev)),
    },
    {
      label: "Members can message the moderators",
      description: "Lets people raise something privately with the team, including appeals.",
      value: allowModmail,
      set: () => setAllowModmailDraft((prev) => (prev === null ? !allowModmail : !prev)),
    },
  ];

  return (
    <CommunitySettingsFrame
      community={community}
      title="Chat"
      lede="The welcome message new members get, and how community chat works."
      actions={<Link href={`/messages/community?community=${community.slug}`} className="pq-button pq-button--sm pq-button--secondary">Open the inbox</Link>}
    >
      <form onSubmit={handleSave} className="grid gap-5">
        <div>
          <FieldLabel htmlFor="welcome-message" hint={`${welcomeMessage.length}/1000`}>Welcome message</FieldLabel>
          <textarea id="welcome-message" className="pq-field" value={welcomeMessage} onChange={(event) => setWelcomeMessageDraft(event.target.value)} rows={4} placeholder="Sent to each new member, and shown on the home page while they're a member." maxLength={1000} />
        </div>

        <div className="grid gap-3">
          <p className="pq-label">Chat</p>
          {toggles.map((toggle) => (
            <div key={toggle.label} className="pq-switch-row" style={!canManageToggles ? { opacity: 0.6 } : undefined}>
              <span>
                <span className="block font-medium">{toggle.label}</span>
                <span className="block text-sm text-subdued">{toggle.description}</span>
              </span>
              {canManageToggles ? (
                <Switch checked={toggle.value} onChange={toggle.set} label={toggle.label} />
              ) : (
                <span className="text-sm text-subdued">{toggle.value ? "On" : "Off"}</span>
              )}
            </div>
          ))}
          {!canManageToggles && <p className="text-sm text-subdued">Only admins change these. You can edit the welcome message.</p>}
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
        {success && <Notice>Chat settings saved.</Notice>}

        <div className="pq-settings-foot">
          <Button type="submit" variant="primary" loading={updating} loadingText="Saving…">Save</Button>
        </div>
      </form>
    </CommunitySettingsFrame>
  );
}
