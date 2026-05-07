"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  useCommunityAnnouncements,
  useCommunityChatActions,
  useCommunityChatMemberSearch,
  useCommunityChatOverview,
  useCommunityChatMemberships,
  useCommunityChatMessages,
  useCommunityChatThreads,
} from "@/lib/hooks";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import { showToast } from "@/lib/utils/toast";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getStatusBadgeClass(status: "active" | "muted" | "banned") {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "muted") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getRoleBadgeClass(role: "admin" | "moderator" | "member") {
  if (role === "admin") return "bg-orange-warm/10 text-orange-warm";
  if (role === "moderator") return "bg-purple-primary/10 text-purple-primary";
  return "bg-skeleton/70 text-muted";
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 rounded-full bg-surface shadow-sm font-ui text-[0.75rem] text-muted">
        {formatDateDivider(date)}
      </span>
    </div>
  );
}

function isSystemMessage(messageType: string, senderRole: string): boolean {
  if (senderRole === "system") return true;
  return (
    messageType === "mod_action" ||
    messageType === "status_update" ||
    messageType === "welcome"
  );
}

function getSystemLabel(messageType: string): string {
  if (messageType === "mod_action") return "Moderation Update";
  if (messageType === "status_update") return "Status Update";
  if (messageType === "welcome") return "Welcome";
  return messageType.replace(/_/g, " ");
}

const COMMUNITY_THREAD_ID = "__community_chat__";
const STAFF_RECENT_THREADS_LIMIT = 40;

interface StaffThreadTarget {
  threadId: string;
  memberId: string;
  status: "active" | "muted" | "banned";
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function getRecentThreadsStorageKey(userId: string, communityId: string): string {
  return `community-chat-staff-recents:${userId}:${communityId}`;
}

export default function CommunityInboxView() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedCommunity = searchParams.get("community");

  const {
    memberships,
    loading: membershipsLoading,
    error: membershipsError,
    refetch: refetchMemberships,
  } = useCommunityChatMemberships(user?.id);
  const {
    overviewByCommunity,
    loading: overviewLoading,
    error: overviewError,
  } = useCommunityChatOverview(user?.id);

  const [selectedCommunityIdState, setSelectedCommunityIdState] = useState<string | null>(null);
  const [selectedThreadIdState, setSelectedThreadIdState] = useState<string | null>(null);
  const [selectedStaffTarget, setSelectedStaffTarget] = useState<StaffThreadTarget | null>(null);
  const [staffRecentThreads, setStaffRecentThreads] = useState<StaffThreadTarget[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sendAsAppeal, setSendAsAppeal] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [staffMessageMode, setStaffMessageMode] = useState<"message" | "announcement">("message");
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const sortedMemberships = useMemo(() => {
    const entries = memberships.map((membership) => {
      const overview = overviewByCommunity.get(membership.community_id);
      return {
        membership,
        unreadCount: overview?.unread_count || 0,
        lastMessageAt: overview?.last_message_at || null,
      };
    });

    entries.sort((a, b) => {
      const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (aTs !== bTs) return bTs - aTs;
      return a.membership.community.name.localeCompare(b.membership.community.name);
    });

    return entries;
  }, [memberships, overviewByCommunity]);

  const selectedCommunityId = useMemo(() => {
    if (sortedMemberships.length === 0) return null;
    if (
      selectedCommunityIdState &&
      sortedMemberships.some((entry) => entry.membership.community_id === selectedCommunityIdState)
    ) {
      return selectedCommunityIdState;
    }

    const byQuery = requestedCommunity
      ? sortedMemberships.find((entry) => entry.membership.community.slug === requestedCommunity)
      : undefined;

    return byQuery?.membership.community_id || sortedMemberships[0].membership.community_id;
  }, [sortedMemberships, requestedCommunity, selectedCommunityIdState]);

  const selectedMembership = useMemo(
    () => memberships.find((m) => m.community_id === selectedCommunityId) || null,
    [memberships, selectedCommunityId]
  );

  const isStaff =
    selectedMembership?.role === "admin" ||
    selectedMembership?.role === "moderator";

  const isChatEnabled = selectedMembership?.community.community_chat_enabled !== false;
  const allowMemberMessages =
    selectedMembership?.community.community_chat_allow_member_messages !== false;
  const allowMemberModmail =
    selectedMembership?.community.community_chat_allow_modmail !== false;
  const canSendCommunityBroadcast =
    selectedMembership?.role === "admin" ||
    (selectedMembership?.role === "moderator" &&
      selectedMembership?.permissions?.can_send_community_chat_messages !== false);
  const isCommunityChatJoined = selectedMembership?.community_chat_joined === true;

  const {
    threads,
    loading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useCommunityChatThreads(
    selectedCommunityId || "",
    user?.id,
    isStaff,
    { includeStaffThreads: true }
  );

  const {
    results: memberSearchResults,
    loading: memberSearchLoading,
    error: memberSearchError,
  } = useCommunityChatMemberSearch(
    selectedCommunityId || "",
    memberSearchQuery,
    !!(isStaff && selectedCommunityId && isChatEnabled)
  );

  const memberDirectThreadId = threads[0]?.id || null;

  const selectedThreadId = useMemo(() => {
    if (!selectedCommunityId) return null;

    if (isStaff) {
      return selectedThreadIdState || COMMUNITY_THREAD_ID;
    }

    if (selectedThreadIdState === COMMUNITY_THREAD_ID) {
      return COMMUNITY_THREAD_ID;
    }

    if (selectedThreadIdState && memberDirectThreadId && selectedThreadIdState === memberDirectThreadId) {
      return memberDirectThreadId;
    }

    return COMMUNITY_THREAD_ID;
  }, [selectedCommunityId, isStaff, selectedThreadIdState, memberDirectThreadId]);

  const isCommunityThreadSelected = selectedThreadId === COMMUNITY_THREAD_ID;
  const directThreadId = !selectedThreadId || isCommunityThreadSelected ? "" : selectedThreadId;

  const {
    messages: directMessages,
    loading: directMessagesLoading,
    sending,
    error: directMessagesError,
    sendMessage,
  } = useCommunityChatMessages(directThreadId, user?.id);

  const {
    messages: communityMessages,
    loading: communityMessagesLoading,
    error: communityMessagesError,
  } = useCommunityAnnouncements(selectedCommunityId || "", user?.id);

  const {
    broadcasting,
    postingToCommunity,
    updatingJoinState,
    broadcastToCommunity,
    postCommunityMessage,
    setCommunityChatJoinState,
  } = useCommunityChatActions();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeMessages = isCommunityThreadSelected ? communityMessages : directMessages;
  const activeMessagesLoading = isCommunityThreadSelected ? communityMessagesLoading : directMessagesLoading;
  const activeError = isCommunityThreadSelected ? communityMessagesError : directMessagesError;
  const isSending = isCommunityThreadSelected ? broadcasting || postingToCommunity : sending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  const canAppeal =
    !!selectedMembership &&
    selectedMembership.role === "member" &&
    !isCommunityThreadSelected &&
    allowMemberModmail &&
    (selectedMembership.status === "muted" || selectedMembership.status === "banned");

  const canSendInCurrentThread = useMemo(() => {
    if (!selectedMembership || !isChatEnabled) return false;
    if (isCommunityThreadSelected) {
      if (isStaff) return canSendCommunityBroadcast;
      if (selectedMembership.status !== "active") return false;
      if (!isCommunityChatJoined) return false;
      return allowMemberMessages;
    }
    if (isStaff) return true;
    if (!allowMemberModmail) return false;
    if (sendAsAppeal) {
      return selectedMembership.status === "muted" || selectedMembership.status === "banned";
    }
    return true;
  }, [
    selectedMembership,
    isChatEnabled,
    isCommunityThreadSelected,
    canSendCommunityBroadcast,
    isStaff,
    isCommunityChatJoined,
    allowMemberModmail,
    sendAsAppeal,
    allowMemberMessages,
  ]);

  useEffect(() => {
    setSelectedThreadIdState(null);
    setSelectedStaffTarget(null);
    setMemberSearchQuery("");
    setSendAsAppeal(false);
    setDraft("");
    setShowHeaderMenu(false);
    setStaffMessageMode("message");
  }, [selectedCommunityId]);

  useEffect(() => {
    setStaffMessageMode("message");
  }, [selectedThreadId]);

  useEffect(() => {
    if (!showHeaderMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHeaderMenu]);

  useEffect(() => {
    if (!isStaff || !selectedCommunityId || !user?.id) {
      setStaffRecentThreads([]);
      return;
    }

    if (typeof window === "undefined") return;

    const storageKey = getRecentThreadsStorageKey(user.id, selectedCommunityId);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setStaffRecentThreads([]);
        return;
      }

      const parsed = JSON.parse(raw) as StaffThreadTarget[];
      if (!Array.isArray(parsed)) {
        setStaffRecentThreads([]);
        return;
      }

      const normalized = parsed
        .filter((item) => item && typeof item.memberId === "string" && typeof item.threadId === "string")
        .slice(0, STAFF_RECENT_THREADS_LIMIT);

      setStaffRecentThreads(normalized);
    } catch {
      setStaffRecentThreads([]);
    }
  }, [isStaff, selectedCommunityId, user?.id]);

  const saveStaffRecentThreads = useCallback(
    (nextThreads: StaffThreadTarget[]) => {
      setStaffRecentThreads(nextThreads);
      if (!user?.id || !selectedCommunityId || typeof window === "undefined") return;
      const storageKey = getRecentThreadsStorageKey(user.id, selectedCommunityId);
      window.localStorage.setItem(storageKey, JSON.stringify(nextThreads));
    },
    [selectedCommunityId, user?.id]
  );

  const upsertStaffRecentThread = useCallback(
    (target: StaffThreadTarget) => {
      const next = [target, ...staffRecentThreads.filter((thread) => thread.memberId !== target.memberId)]
        .slice(0, STAFF_RECENT_THREADS_LIMIT);
      saveStaffRecentThreads(next);
    },
    [staffRecentThreads, saveStaffRecentThreads]
  );

  const openStaffThreadForMember = async (
    member: {
      user_id: string;
      status: "active" | "muted" | "banned";
      profile: {
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      } | null;
    }
  ) => {
    if (!selectedCommunityId || !member.profile) return;

    try {
      const { data, error } = await supabase.rpc("ensure_community_chat_thread", {
        p_community_id: selectedCommunityId,
        p_member_id: member.user_id,
      });

      if (error || !data) throw error || new Error("Thread not found");

      const target: StaffThreadTarget = {
        threadId: data as string,
        memberId: member.user_id,
        status: member.status,
        username: member.profile.username,
        displayName: member.profile.display_name,
        avatarUrl: member.profile.avatar_url,
      };

      setSelectedThreadIdState(target.threadId);
      setSelectedStaffTarget(target);
      upsertStaffRecentThread(target);
      setSendAsAppeal(false);
      setMemberSearchQuery("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open member thread";
      showToast.error("Thread unavailable", message);
    }
  };

  const handleJoinCommunityChat = async (joined: boolean) => {
    if (!selectedMembership) return;

    const result = await setCommunityChatJoinState(selectedMembership.community_id, joined);
    if (!result.success) {
      showToast.error("Unable to update participation", result.error || "Please try again.");
      return;
    }

    await refetchMemberships();
    showToast.success(
      joined ? "Joined community chat" : "Left community chat",
      joined
        ? "You will now see and receive community chat messages."
        : "You can rejoin anytime from this thread."
    );
  };

  const canToggleAnnouncement =
    isCommunityThreadSelected && isStaff && canSendCommunityBroadcast;

  const handleDraftChange = (value: string) => {
    if (canToggleAnnouncement) {
      // Slash shortcut: typing `/announce` or `/announcement` (with optional space)
      // at the very start auto-flips into Announcement mode and strips the prefix.
      const slashMatch = value.match(/^\/(announce|announcement)(\s|$)/i);
      if (slashMatch) {
        setStaffMessageMode("announcement");
        setDraft(value.slice(slashMatch[0].length));
        return;
      }
      // Mirror: typing `/message` flips back.
      const messageMatch = value.match(/^\/(message|msg)(\s|$)/i);
      if (messageMatch) {
        setStaffMessageMode("message");
        setDraft(value.slice(messageMatch[0].length));
        return;
      }
    }
    setDraft(value);
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    if (!selectedMembership) return;
    if (!canSendInCurrentThread) return;

    if (isCommunityThreadSelected) {
      if (isStaff) {
        if (staffMessageMode === "announcement") {
          const result = await broadcastToCommunity(selectedMembership.community_id, draft);
          if (!result.success) {
            showToast.error("Announcement failed", result.error);
            return;
          }

          showToast.success(
            "Announcement sent",
            `Delivered to ${result.sentCount || 0} member${result.sentCount === 1 ? "" : "s"}`
          );
          setDraft("");
          setStaffMessageMode("message");
          return;
        }

        const result = await postCommunityMessage(selectedMembership.community_id, draft);
        if (!result.success) {
          showToast.error("Message failed", result.error);
          return;
        }

        setDraft("");
        return;
      }

      const result = await postCommunityMessage(selectedMembership.community_id, draft);
      if (!result.success) {
        showToast.error("Message failed", result.error);
        return;
      }

      setDraft("");
      return;
    }

    const result = await sendMessage(draft, {
      messageType: sendAsAppeal ? "appeal" : "message",
    });

    if (!result.success) {
      showToast.error("Message failed", result.error);
      return;
    }

    if (sendAsAppeal) {
      showToast.success("Appeal submitted", "Moderators will review your message.");
    }
    setDraft("");
    setSendAsAppeal(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="text-center">
          <h1 className="font-display text-2xl text-ink mb-3">Community Inbox</h1>
          <p className="font-body text-muted mb-6">Sign in to view community chat.</p>
          <Link
            href="/login"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const combinedError =
    membershipsError || overviewError || memberSearchError || threadsError || activeError;

  const welcomeMessage = selectedMembership?.community.welcome_message?.trim() || null;
  const communityName = selectedMembership?.community.name || "";
  const communityAvatar = selectedMembership?.community.avatar_url || DEFAULT_AVATAR;
  const communitySlug = selectedMembership?.community.slug || "";

  const headerTitle = isCommunityThreadSelected
    ? communityName
    : isStaff
    ? selectedStaffTarget?.displayName || selectedStaffTarget?.username || "Member"
    : "Moderation Team";

  const headerSubtitle = isCommunityThreadSelected
    ? "Community Chat"
    : isStaff
    ? `@${selectedStaffTarget?.username || "unknown"}`
    : `Private thread · ${communityName}`;

  const showLeaveAction =
    isCommunityThreadSelected && !isStaff && isCommunityChatJoined && selectedMembership?.status === "active";

  const showJoinCTA =
    isCommunityThreadSelected && !isStaff && !isCommunityChatJoined && isChatEnabled;

  const inputDisabledReason = !isChatEnabled
    ? "Community chat is disabled by the admin."
    : isCommunityThreadSelected
    ? isStaff
      ? canSendCommunityBroadcast
        ? null
        : "You don't have permission to broadcast here."
      : selectedMembership?.status !== "active"
      ? "You can't post while your membership is restricted."
      : !allowMemberMessages
      ? "Members can read this chat, but posting is currently off."
      : null
    : !allowMemberModmail
    ? "Messaging the moderation team is currently disabled."
    : null;

  const inlineHint =
    isCommunityThreadSelected && isStaff && canSendCommunityBroadcast
      ? "Broadcasting to all joined members"
      : isCommunityThreadSelected && !isStaff && isCommunityChatJoined && allowMemberMessages
      ? "Visible to everyone in this community chat"
      : !isCommunityThreadSelected && !isStaff && !sendAsAppeal && allowMemberModmail
      ? "Only the moderation team can see this"
      : !isCommunityThreadSelected && !isStaff && sendAsAppeal
      ? "Submitting an appeal to the moderators"
      : null;

  return (
    <div className="h-screen bg-canvas flex flex-col md:flex-row">
      {/* Communities */}
      <aside className="md:w-[280px] w-full md:border-r border-border-light bg-surface flex flex-col">
        <div
          className="px-4 py-3 border-b border-border-light flex items-center justify-between"
          style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}
        >
          <div>
            <h1 className="font-display text-xl text-ink">Communities</h1>
            <p className="font-ui text-xs text-muted">Your community conversations</p>
          </div>
          <Link
            href="/messages"
            className="px-3 py-1.5 rounded-full bg-skeleton/70 hover:bg-skeleton text-xs font-ui text-ink transition-colors"
          >
            DMs
          </Link>
        </div>

        {membershipsLoading || (overviewLoading && memberships.length === 0) ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
          </div>
        ) : sortedMemberships.length === 0 ? (
          <div className="flex-1 p-6 text-center">
            <p className="font-body text-muted">You are not in any communities yet.</p>
            <Link
              href="/community"
              className="inline-flex mt-4 px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm"
            >
              Explore Communities
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {sortedMemberships.map(({ membership, unreadCount }) => {
              const isSelected = membership.community_id === selectedCommunityId;
              return (
                <button
                  key={membership.community_id}
                  onClick={() => {
                    setSelectedCommunityIdState(membership.community_id);
                    setSelectedThreadIdState(null);
                    setSendAsAppeal(false);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border-light transition-colors ${
                    isSelected ? "bg-purple-primary/8" : "hover:bg-subtle"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={membership.community.avatar_url || DEFAULT_AVATAR}
                      alt={membership.community.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-ui text-sm text-ink font-medium truncate">
                          {membership.community.name}
                        </p>
                        {unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-gradient-to-r from-pink-vivid to-purple-primary text-white font-ui text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-ui uppercase ${getRoleBadgeClass(
                            membership.role
                          )}`}
                        >
                          {membership.role}
                        </span>
                        {membership.status !== "active" && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-ui uppercase ${getStatusBadgeClass(
                              membership.status
                            )}`}
                          >
                            {membership.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Thread list */}
      {selectedMembership && (
        <aside className="hidden md:flex w-[280px] border-r border-border-light bg-surface flex-col">
          <div className="px-4 py-3 border-b border-border-light">
            <p className="font-ui text-[11px] uppercase tracking-wider text-muted font-medium">Channels</p>
          </div>

          <button
            onClick={() => {
              setSelectedThreadIdState(COMMUNITY_THREAD_ID);
              setSelectedStaffTarget(null);
              setSendAsAppeal(false);
            }}
            className={`w-full text-left px-4 py-3 border-b border-border-light transition-colors ${
              selectedThreadId === COMMUNITY_THREAD_ID
                ? "bg-purple-primary/8"
                : "hover:bg-subtle"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-pink-vivid/10 text-pink-vivid flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm text-ink font-medium truncate">Community Chat</p>
                <p className="font-ui text-xs text-muted truncate">
                  {isStaff
                    ? "Everyone in the community"
                    : isCommunityChatJoined
                    ? "You're in this conversation"
                    : "Tap to join"}
                </p>
              </div>
            </div>
          </button>

          {!isStaff && (
            <button
              onClick={() => {
                if (memberDirectThreadId) {
                  setSelectedThreadIdState(memberDirectThreadId);
                  setSendAsAppeal(false);
                }
              }}
              className={`w-full text-left px-4 py-3 border-b border-border-light transition-colors ${
                selectedThreadId === memberDirectThreadId
                  ? "bg-purple-primary/8"
                  : "hover:bg-subtle"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-primary/10 text-purple-primary flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-ui text-sm text-ink font-medium truncate">Moderation Team</p>
                  <p className="font-ui text-xs text-muted truncate">Just you and the mods</p>
                </div>
              </div>
            </button>
          )}

          {isStaff && (
            <>
              <div className="px-4 py-3 border-b border-border-light">
                <label className="block font-ui text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
                  Find a member
                </label>
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(event) => setMemberSearchQuery(event.target.value)}
                  placeholder="Name or @username"
                  className="w-full px-3 py-2 rounded-full bg-skeleton/70 border-none outline-none focus:ring-2 focus:ring-purple-primary/20 font-ui text-sm text-ink"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Active member threads — sorted by most recent message */}
                {threads.length > 0 && !memberSearchQuery.trim() && (
                  <div>
                    <p className="px-4 py-2 font-ui text-[11px] uppercase tracking-wider text-muted font-medium">
                      Active threads
                    </p>
                    {threads
                      .filter((t) => t.last_message_at)
                      .map((thread) => {
                        const profile = thread.member_profile;
                        const isSelected =
                          selectedThreadId !== COMMUNITY_THREAD_ID &&
                          selectedStaffTarget?.memberId === thread.member_id;

                        return (
                          <button
                            key={`thread-${thread.id}`}
                            onClick={() => {
                              setSelectedThreadIdState(thread.id);
                              setSelectedStaffTarget({
                                threadId: thread.id,
                                memberId: thread.member_id,
                                status: "active",
                                username: profile?.username || "unknown",
                                displayName: profile?.display_name || null,
                                avatarUrl: profile?.avatar_url || null,
                              });
                              setSendAsAppeal(false);
                            }}
                            className={`w-full text-left px-4 py-3 border-t border-border-light transition-colors ${
                              isSelected ? "bg-purple-primary/8" : "hover:bg-subtle"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={profile?.avatar_url || DEFAULT_AVATAR}
                                  alt={profile?.username || ""}
                                  className="w-9 h-9 rounded-full object-cover"
                                />
                                {thread.has_unread && (
                                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gradient-to-r from-pink-vivid to-purple-primary rounded-full border-2 border-white" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`font-ui text-sm truncate ${thread.has_unread ? "text-ink font-semibold" : "text-ink"}`}>
                                  {profile?.display_name || profile?.username || "Member"}
                                </p>
                                <p className="font-ui text-xs text-muted truncate">@{profile?.username || "unknown"}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}

                {memberSearchQuery.trim().length >= 2 && memberSearchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                  </div>
                ) : memberSearchResults.length === 0 ? (
                  <div className="p-4">
                    <p className="font-ui text-sm text-muted">No members matched your search.</p>
                  </div>
                ) : (
                  memberSearchResults.map((member) => {
                    const username = member.profile?.username || "unknown";
                    const displayName =
                      member.profile?.display_name || member.profile?.username || "Member";
                    const isSelected =
                      selectedThreadId !== COMMUNITY_THREAD_ID &&
                      selectedStaffTarget?.memberId === member.user_id;

                    return (
                      <button
                        key={member.user_id}
                        onClick={() => openStaffThreadForMember(member)}
                        className={`w-full text-left px-4 py-3 border-b border-border-light transition-colors ${
                          isSelected ? "bg-purple-primary/8" : "hover:bg-subtle"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={member.profile?.avatar_url || DEFAULT_AVATAR}
                            alt={username}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-ui text-sm text-ink truncate">{displayName}</p>
                            <p className="font-ui text-xs text-muted truncate">@{username}</p>
                          </div>
                          {member.status !== "active" && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-ui uppercase ${getStatusBadgeClass(
                                member.status
                              )}`}
                            >
                              {member.status}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>
      )}

      {/* Chat */}
      <section className="flex-1 flex flex-col bg-canvas min-w-0">
        {!selectedMembership ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-primary/15 to-pink-vivid/15 flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="font-display text-xl text-ink mb-1">Pick a community</h2>
              <p className="font-body text-sm text-muted">
                Choose one from your list to open its chat.
              </p>
            </div>
          </div>
        ) : !isChatEnabled ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-skeleton/70 flex items-center justify-center">
                <svg className="w-7 h-7 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h2 className="font-display text-xl text-ink mb-1">Chat is paused here</h2>
              <p className="font-body text-sm text-muted">
                The admins of {communityName} have turned community chat off for now.
              </p>
            </div>
          </div>
        ) : !selectedThreadId ? (
          <div className="flex-1 flex items-center justify-center">
            {threadsLoading ? (
              <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
            ) : (
              <p className="font-body text-muted text-sm">
                {isStaff ? "Select a member thread to start chatting." : "No chat thread available."}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border-light">
              {isCommunityThreadSelected ? (
                <Link
                  href={`/community/${communitySlug}`}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  <img
                    src={communityAvatar}
                    alt={communityName}
                    className="w-11 h-11 rounded-full object-cover group-hover:ring-2 group-hover:ring-purple-primary/30 transition-all"
                  />
                  <div className="min-w-0">
                    <h2 className="font-ui text-[1rem] font-medium text-ink truncate group-hover:text-accent transition-colors">
                      {headerTitle}
                    </h2>
                    <p className="font-ui text-[0.78rem] text-muted truncate">
                      {headerSubtitle}
                    </p>
                  </div>
                </Link>
              ) : isStaff && selectedStaffTarget ? (
                <Link
                  href={`/studio/${selectedStaffTarget.username}`}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  <img
                    src={selectedStaffTarget.avatarUrl || DEFAULT_AVATAR}
                    alt={selectedStaffTarget.username}
                    className="w-11 h-11 rounded-full object-cover group-hover:ring-2 group-hover:ring-purple-primary/30 transition-all"
                  />
                  <div className="min-w-0">
                    <h2 className="font-ui text-[1rem] font-medium text-ink truncate group-hover:text-accent transition-colors">
                      {headerTitle}
                    </h2>
                    <p className="font-ui text-[0.78rem] text-muted truncate">
                      {headerSubtitle}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-primary/15 to-pink-vivid/15 text-purple-primary flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-ui text-[1rem] font-medium text-ink truncate">
                      {headerTitle}
                    </h2>
                    <p className="font-ui text-[0.78rem] text-muted truncate">
                      {headerSubtitle}
                    </p>
                  </div>
                </div>
              )}

              <div className="relative" ref={headerMenuRef}>
                <button
                  onClick={() => setShowHeaderMenu((prev) => !prev)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-purple-50 transition-all"
                  aria-label="Chat options"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
                {showHeaderMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-lg border border-border-light overflow-hidden z-50 animate-fadeIn">
                    <Link
                      href={`/community/${communitySlug}`}
                      onClick={() => setShowHeaderMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-skeleton/60 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      View community
                    </Link>
                    {isStaff && isCommunityThreadSelected && (
                      <Link
                        href={`/community/${communitySlug}/settings`}
                        onClick={() => setShowHeaderMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-skeleton/60 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Chat settings
                      </Link>
                    )}
                    {showLeaveAction && (
                      <>
                        <div className="h-px bg-skeleton mx-3" />
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false);
                            setShowLeaveConfirm(true);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Leave community chat
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile thread switcher */}
            {selectedMembership && (
              <div className="md:hidden px-4 py-3 bg-surface border-b border-border-light flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedThreadIdState(COMMUNITY_THREAD_ID);
                      setSelectedStaffTarget(null);
                      setSendAsAppeal(false);
                    }}
                    className={`flex-1 px-3 py-2 rounded-full font-ui text-xs transition-colors ${
                      selectedThreadId === COMMUNITY_THREAD_ID
                        ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                        : "bg-skeleton/70 text-ink"
                    }`}
                  >
                    Community
                  </button>
                  {!isStaff && (
                    <button
                      onClick={() => {
                        if (memberDirectThreadId) {
                          setSelectedThreadIdState(memberDirectThreadId);
                          setSendAsAppeal(false);
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-full font-ui text-xs transition-colors ${
                        selectedThreadId === memberDirectThreadId
                          ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                          : "bg-skeleton/70 text-ink"
                      }`}
                    >
                      Mod Team
                    </button>
                  )}
                </div>
                {isStaff && (
                  <>
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(event) => setMemberSearchQuery(event.target.value)}
                      placeholder="Search a member..."
                      className="w-full px-3 py-2 rounded-full bg-skeleton/70 border-none outline-none focus:ring-2 focus:ring-purple-primary/20 font-ui text-xs text-ink"
                    />
                    {staffRecentThreads.length > 0 && !memberSearchQuery.trim() && (
                      <div className="rounded-xl border border-border-light bg-surface overflow-hidden">
                        {staffRecentThreads.slice(0, 4).map((thread) => (
                          <button
                            key={`mobile-recent-${thread.memberId}`}
                            onClick={() => {
                              setSelectedThreadIdState(thread.threadId);
                              setSelectedStaffTarget(thread);
                              setSendAsAppeal(false);
                            }}
                            className="w-full text-left px-3 py-2 border-b border-border-light last:border-b-0 hover:bg-subtle"
                          >
                            <p className="font-ui text-xs text-ink truncate">
                              {thread.displayName || thread.username}
                            </p>
                            <p className="font-ui text-[11px] text-muted truncate">@{thread.username}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {memberSearchQuery.trim().length >= 2 && (
                      <div className="rounded-xl border border-border-light bg-surface max-h-44 overflow-y-auto">
                        {memberSearchLoading ? (
                          <div className="py-3 flex justify-center">
                            <div className="w-5 h-5 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                          </div>
                        ) : memberSearchResults.length === 0 ? (
                          <p className="px-3 py-2 font-ui text-xs text-muted">No matching members.</p>
                        ) : (
                          memberSearchResults.slice(0, 5).map((member) => (
                            <button
                              key={member.user_id}
                              onClick={() => openStaffThreadForMember(member)}
                              className="w-full text-left px-3 py-2 border-b border-border-light last:border-b-0 hover:bg-subtle"
                            >
                              <p className="font-ui text-xs text-ink truncate">
                                {member.profile?.display_name || member.profile?.username || "Member"}
                              </p>
                              <p className="font-ui text-[11px] text-muted truncate">
                                @{member.profile?.username || "unknown"}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {combinedError && (
              <div className="px-4 py-2 bg-red-50/80 text-red-600 font-ui text-xs text-center">
                {combinedError}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
              {showJoinCTA ? (
                <div className="h-full flex items-center justify-center px-4">
                  <div className="max-w-md text-center">
                    <img
                      src={communityAvatar}
                      alt={communityName}
                      className="w-20 h-20 rounded-full object-cover mx-auto mb-4 shadow-lg"
                    />
                    <h3 className="font-display text-2xl text-ink mb-2">
                      Welcome to {communityName}
                    </h3>
                    {welcomeMessage ? (
                      <div className="px-5 py-4 rounded-2xl bg-surface border border-border-light shadow-sm mb-5">
                        <p className="font-body text-[0.95rem] text-ink leading-relaxed italic">
                          &ldquo;{welcomeMessage}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <p className="font-body text-sm text-muted mb-5 leading-relaxed">
                        Join the community chat to read announcements and share with everyone here.
                      </p>
                    )}
                    <button
                      onClick={() => handleJoinCommunityChat(true)}
                      disabled={updatingJoinState || selectedMembership.status !== "active"}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {updatingJoinState ? "Joining..." : "Join Community Chat"}
                    </button>
                    {selectedMembership.status !== "active" && (
                      <p className="font-ui text-[11px] text-muted italic mt-3">
                        Your membership is currently {selectedMembership.status}.
                      </p>
                    )}
                  </div>
                </div>
              ) : activeMessagesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center px-4">
                  <div className="max-w-sm text-center">
                    <img
                      src={
                        isCommunityThreadSelected || !isStaff
                          ? communityAvatar
                          : selectedStaffTarget?.avatarUrl || DEFAULT_AVATAR
                      }
                      alt=""
                      className="w-20 h-20 rounded-full object-cover mx-auto mb-4 shadow-lg"
                    />
                    {isCommunityThreadSelected ? (
                      <>
                        <h3 className="font-display text-xl text-ink mb-2">
                          Welcome to {communityName}
                        </h3>
                        {welcomeMessage ? (
                          <p className="font-body text-sm text-ink/80 italic leading-relaxed">
                            &ldquo;{welcomeMessage}&rdquo;
                          </p>
                        ) : (
                          <p className="font-body text-sm text-muted italic">
                            {isStaff
                              ? "Write the first announcement to greet your community."
                              : "Be the first to share something here."}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="font-display text-xl text-ink mb-1">
                          {isStaff
                            ? selectedStaffTarget?.displayName || selectedStaffTarget?.username
                            : "Moderation Team"}
                        </h3>
                        <p className="font-body text-sm text-muted italic">
                          {isStaff
                            ? "Start a private conversation with this member."
                            : "Reach out privately to the moderators of this community."}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Pinned welcome at top of community thread */}
                  {isCommunityThreadSelected && welcomeMessage && (
                    <div className="flex justify-center mb-3">
                      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-surface border-2 border-purple-300">
                        <p className="font-ui text-[10px] uppercase tracking-wider font-semibold text-purple-primary mb-1">
                          Welcome
                        </p>
                        <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
                          {welcomeMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  {activeMessages.map((message, index) => {
                    const isOwn = message.sender_id === user.id;
                    const prev = index > 0 ? activeMessages[index - 1] : null;
                    const showDate =
                      !prev ||
                      new Date(prev.created_at).toDateString() !==
                        new Date(message.created_at).toDateString();

                    const senderRole = message.sender_role || "member";
                    const senderName =
                      message.sender_profile?.display_name ||
                      message.sender_profile?.username ||
                      (senderRole === "member" ? "Community Member" : "Moderator");
                    const senderUsername = message.sender_profile?.username;
                    const senderAvatar = message.sender_profile?.avatar_url || DEFAULT_AVATAR;

                    // System message card (mod_action, status_update, welcome, or system sender)
                    if (isSystemMessage(message.message_type, senderRole)) {
                      return (
                        <div key={message.id}>
                          {showDate && <DateDivider date={message.created_at} />}
                          <div className="flex justify-center py-1.5">
                            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/60">
                              <div className="flex items-center gap-1.5 mb-1">
                                <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                                <p className="font-ui text-[10px] uppercase tracking-wider text-amber-700 font-medium">
                                  {getSystemLabel(message.message_type)}
                                </p>
                              </div>
                              <p className="font-body text-sm text-amber-900 leading-relaxed whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Announcement — same bubble as a regular message, just with a brand border
                    if (
                      isCommunityThreadSelected &&
                      message.message_type === "announcement"
                    ) {
                      return (
                        <div key={message.id}>
                          {showDate && <DateDivider date={message.created_at} />}
                          <div className={`flex items-end gap-2 mb-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                            {!isOwn && (
                              senderUsername ? (
                                <Link href={`/studio/${senderUsername}`} className="flex-shrink-0">
                                  <img
                                    src={senderAvatar}
                                    alt={senderName}
                                    className="w-7 h-7 rounded-full object-cover"
                                  />
                                </Link>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-purple-primary/10" />
                              )
                            )}
                            <div className="max-w-[70%]">
                              {!isOwn && (
                                <p className="font-ui text-[11px] text-muted ml-1 mb-0.5 truncate">
                                  {senderName}
                                </p>
                              )}
                              <div className={`px-4 py-2.5 rounded-2xl border-2 border-pink-vivid/50 ${
                                isOwn
                                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-br-md"
                                  : "bg-surface text-ink rounded-bl-md"
                              }`}>
                                <p className={`font-ui text-[10px] uppercase tracking-wider font-semibold mb-1 ${
                                  isOwn ? "text-white/80" : "text-pink-vivid"
                                }`}>
                                  Announcement
                                </p>
                                <p className="font-body text-sm leading-relaxed whitespace-pre-wrap break-words">
                                  {message.content}
                                </p>
                                <p className={`font-ui text-[10px] mt-1 ${isOwn ? "text-white/70 text-right" : "text-muted"}`}>
                                  {formatTime(message.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Regular message bubble (matches DM design)
                    return (
                      <div key={message.id}>
                        {showDate && <DateDivider date={message.created_at} />}
                        <div className={`flex items-end gap-2 mb-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                          {!isOwn && (
                            senderUsername ? (
                              <Link href={`/studio/${senderUsername}`} className="flex-shrink-0">
                                <img
                                  src={senderAvatar}
                                  alt={senderName}
                                  className="w-7 h-7 rounded-full object-cover hover:ring-2 hover:ring-purple-primary/30 transition-all"
                                />
                              </Link>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-purple-primary/10 text-purple-primary flex items-center justify-center flex-shrink-0">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                              </div>
                            )
                          )}
                          <div className="max-w-[70%]">
                            {!isOwn && (
                              <div className="flex items-center gap-1.5 ml-1 mb-0.5">
                                <p className="font-ui text-[11px] text-muted truncate">
                                  {senderName}
                                </p>
                                {(senderRole === "admin" || senderRole === "moderator") && (
                                  <span className={`px-1.5 py-0 rounded-full text-[9px] uppercase font-ui ${getRoleBadgeClass(senderRole)}`}>
                                    {senderRole === "admin" ? "Admin" : "Mod"}
                                  </span>
                                )}
                              </div>
                            )}
                            <div
                              className={`px-4 py-2.5 rounded-2xl ${
                                isOwn
                                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-br-md"
                                  : "bg-surface shadow-sm text-ink rounded-bl-md"
                              }`}
                            >
                              {message.message_type === "appeal" && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide font-ui mb-1.5 ${
                                    isOwn ? "bg-surface/20 text-white" : "bg-purple-primary/10 text-purple-primary"
                                  }`}
                                >
                                  Appeal
                                </span>
                              )}
                              <p className="font-body text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              <p
                                className={`font-ui text-[10px] mt-1 ${
                                  isOwn ? "text-white/70 text-right" : "text-muted"
                                }`}
                              >
                                {formatTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!showJoinCTA && (
              <div className="px-3 py-3 bg-surface border-t border-border-light">
                {inputDisabledReason ? (
                  <div className="rounded-2xl bg-skeleton/60 px-4 py-3 text-center">
                    <p className="font-ui text-xs text-muted italic">{inputDisabledReason}</p>
                  </div>
                ) : (
                  <>
                    {staffMessageMode === "announcement" && canToggleAnnouncement ? (
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <span className="font-ui text-[10px] tracking-[0.2em] uppercase text-pink-vivid font-semibold">
                          Announcement mode
                        </span>
                        <button
                          onClick={() => setStaffMessageMode("message")}
                          className="font-ui text-[10px] text-muted hover:text-ink underline-offset-2 hover:underline"
                        >
                          cancel
                        </button>
                      </div>
                    ) : (
                      inlineHint && (
                        <p className="font-ui text-[11px] text-muted italic text-center mb-2">
                          {inlineHint}
                        </p>
                      )
                    )}

                    <div className="flex items-end gap-2">
                      {canAppeal && (
                        <button
                          onClick={() => setSendAsAppeal((prev) => !prev)}
                          title={sendAsAppeal ? "Cancel appeal" : "Mark as appeal"}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                            sendAsAppeal
                              ? "bg-purple-primary text-white"
                              : "bg-skeleton/70 text-muted hover:bg-purple-50 hover:text-accent"
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                      )}
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) => handleDraftChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={
                          canToggleAnnouncement && staffMessageMode === "announcement"
                            ? "Write your announcement..."
                            : isCommunityThreadSelected
                            ? isStaff
                              ? "Say something to the community..."
                              : "Say something to the community..."
                            : sendAsAppeal
                            ? "Write your appeal..."
                            : isStaff
                            ? "Reply to this member..."
                            : "Message the moderators..."
                        }
                        className="flex-1 px-4 py-2.5 rounded-full bg-skeleton/60 border-none outline-none focus:ring-2 focus:ring-purple-primary/20 font-body text-sm"
                        disabled={!canSendInCurrentThread}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!canSendInCurrentThread || !draft.trim() || isSending}
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                      >
                        {isSending ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <ConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={async () => {
          await handleJoinCommunityChat(false);
          setShowLeaveConfirm(false);
        }}
        title="Leave community chat?"
        description={`You'll stop receiving and sending messages in ${communityName}'s community chat. You can rejoin anytime from this thread.`}
        confirmText="Leave Chat"
        cancelText="Stay"
        isDanger
        loading={updatingJoinState}
      />
    </div>
  );
}
