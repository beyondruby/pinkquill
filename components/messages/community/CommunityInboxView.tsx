"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadgeClass(status: "active" | "muted" | "banned") {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "muted") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getRoleBadgeClass(role: "admin" | "moderator" | "member") {
  if (role === "admin") return "bg-orange-100 text-orange-700";
  if (role === "moderator") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="px-3 py-1 rounded-full bg-white border border-black/5 text-xs text-muted font-ui">
        {formatDate(date)}
      </span>
    </div>
  );
}

const STAFF_GENERAL_THREAD_ID = "__community_general__";

interface StaffThreadTarget {
  memberId: string;
  status: "active" | "muted" | "banned";
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export default function CommunityInboxView() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedCommunity = searchParams.get("community");

  const {
    memberships,
    loading: membershipsLoading,
    error: membershipsError,
  } = useCommunityChatMemberships(user?.id);
  const {
    overviewByCommunity,
    loading: overviewLoading,
    error: overviewError,
  } = useCommunityChatOverview(user?.id);

  const [selectedCommunityIdState, setSelectedCommunityIdState] = useState<string | null>(null);
  const [selectedThreadIdState, setSelectedThreadIdState] = useState<string | null>(null);
  const [selectedStaffTarget, setSelectedStaffTarget] = useState<StaffThreadTarget | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sendAsAppeal, setSendAsAppeal] = useState(false);

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

  const {
    threads,
    loading: threadsLoading,
    error: threadsError,
    refetch: _refetchThreads,
  } = useCommunityChatThreads(
    selectedCommunityId || "",
    user?.id,
    isStaff,
    { includeStaffThreads: !isStaff }
  );
  void _refetchThreads;

  const {
    results: memberSearchResults,
    loading: memberSearchLoading,
    error: memberSearchError,
  } = useCommunityChatMemberSearch(
    selectedCommunityId || "",
    memberSearchQuery,
    !!(isStaff && selectedCommunityId && isChatEnabled)
  );

  const selectedThreadId = useMemo(() => {
    if (!selectedCommunityId) return null;

    if (isStaff) {
      return selectedThreadIdState || STAFF_GENERAL_THREAD_ID;
    }

    if (threads.length === 0) return null;
    if (selectedThreadIdState && threads.some((thread) => thread.id === selectedThreadIdState)) {
      return selectedThreadIdState;
    }

    return threads[0].id;
  }, [selectedCommunityId, isStaff, threads, selectedThreadIdState]);

  const isGeneralThreadSelected = isStaff && selectedThreadId === STAFF_GENERAL_THREAD_ID;
  const directThreadId = !selectedThreadId || isGeneralThreadSelected ? "" : selectedThreadId;

  const {
    messages: directMessages,
    loading: directMessagesLoading,
    sending,
    error: directMessagesError,
    sendMessage,
  } = useCommunityChatMessages(directThreadId, user?.id);

  const {
    messages: announcementMessages,
    loading: announcementsLoading,
    error: announcementsError,
  } = useCommunityAnnouncements(selectedCommunityId || "", user?.id);

  const { broadcasting, broadcastToCommunity } = useCommunityChatActions();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeMessages = isGeneralThreadSelected ? announcementMessages : directMessages;
  const activeMessagesLoading = isGeneralThreadSelected ? announcementsLoading : directMessagesLoading;
  const activeError = isGeneralThreadSelected ? announcementsError : directMessagesError;
  const isSending = isGeneralThreadSelected ? broadcasting : sending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  const canAppeal =
    !!selectedMembership &&
    selectedMembership.role === "member" &&
    !isGeneralThreadSelected &&
    allowMemberModmail &&
    (selectedMembership.status === "muted" || selectedMembership.status === "banned");

  const canSendInCurrentThread = useMemo(() => {
    if (!selectedMembership || !isChatEnabled) return false;
    if (isGeneralThreadSelected) return canSendCommunityBroadcast;
    if (isStaff) return true;
    if (!allowMemberModmail) return false;
    if (sendAsAppeal) return true;
    return allowMemberMessages;
  }, [
    selectedMembership,
    isChatEnabled,
    isGeneralThreadSelected,
    canSendCommunityBroadcast,
    isStaff,
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
  }, [selectedCommunityId]);

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

      setSelectedThreadIdState(data as string);
      setSelectedStaffTarget({
        memberId: member.user_id,
        status: member.status,
        username: member.profile.username,
        displayName: member.profile.display_name,
        avatarUrl: member.profile.avatar_url,
      });
      setSendAsAppeal(false);
      setMemberSearchQuery("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open member thread";
      showToast.error("Thread unavailable", message);
    }
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    if (!selectedMembership) return;
    if (!canSendInCurrentThread) return;

    if (isGeneralThreadSelected) {
      const result = await broadcastToCommunity(selectedMembership.community_id, draft);
      if (!result.success) {
        showToast.error("Broadcast failed", result.error);
        return;
      }

      showToast.success(
        "Broadcast sent",
        `Delivered to ${result.sentCount || 0} member${result.sentCount === 1 ? "" : "s"}`
      );
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

  return (
    <div className="h-screen bg-[#f8f7fc] flex flex-col md:flex-row">
      {/* Communities */}
      <aside className="md:w-[280px] w-full md:border-r border-black/[0.06] bg-white flex flex-col">
        <div
          className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between"
          style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}
        >
          <div>
            <h1 className="font-display text-xl text-ink">Community Inbox</h1>
            <p className="font-ui text-xs text-muted">Moderation updates and appeals</p>
          </div>
          <Link
            href="/messages"
            className="px-3 py-1.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-xs font-ui text-ink transition-colors"
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
                  className={`w-full text-left px-4 py-3 border-b border-black/[0.04] transition-colors ${
                    isSelected ? "bg-purple-primary/8" : "hover:bg-black/[0.02]"
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
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white font-ui text-[10px] font-semibold flex items-center justify-center">
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

      {/* Thread list for staff */}
      {selectedMembership && isStaff && (
        <aside className="hidden md:flex w-[280px] border-r border-black/[0.06] bg-white flex-col">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <p className="font-ui text-xs uppercase tracking-wide text-muted">Threads</p>
          </div>
          <button
            onClick={() => {
              setSelectedThreadIdState(STAFF_GENERAL_THREAD_ID);
              setSelectedStaffTarget(null);
              setSendAsAppeal(false);
            }}
            className={`w-full text-left px-4 py-3 border-b border-black/[0.04] transition-colors ${
              selectedThreadId === STAFF_GENERAL_THREAD_ID
                ? "bg-purple-primary/8"
                : "hover:bg-black/[0.02]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm text-ink font-medium truncate">General</p>
                <p className="font-ui text-xs text-muted truncate">Message all members</p>
              </div>
            </div>
          </button>
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <label className="block font-ui text-[11px] uppercase tracking-wide text-muted mb-2">
              Find Member Thread
            </label>
            <input
              type="text"
              value={memberSearchQuery}
              onChange={(event) => setMemberSearchQuery(event.target.value)}
              placeholder="Search by name or @username"
              className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-black/[0.06] font-ui text-sm text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {memberSearchQuery.trim().length < 2 ? (
              <div className="p-4">
                <p className="font-ui text-sm text-muted">
                  Type at least 2 characters to find a member thread.
                </p>
              </div>
            ) : memberSearchLoading ? (
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
                  selectedThreadId !== STAFF_GENERAL_THREAD_ID &&
                  selectedStaffTarget?.memberId === member.user_id;

                return (
                  <button
                    key={member.user_id}
                    onClick={() => openStaffThreadForMember(member)}
                    className={`w-full text-left px-4 py-3 border-b border-black/[0.04] transition-colors ${
                      isSelected ? "bg-purple-primary/8" : "hover:bg-black/[0.02]"
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
        </aside>
      )}

      {/* Chat */}
      <section className="flex-1 flex flex-col">
        {!selectedMembership ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-body text-muted">Select a community to open chat.</p>
          </div>
        ) : !isChatEnabled ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="max-w-md text-center">
              <h2 className="font-display text-xl text-ink mb-2">Community Chat Is Disabled</h2>
              <p className="font-body text-muted">
                The admin has turned off community chat for this community.
              </p>
            </div>
          </div>
        ) : !selectedThreadId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-body text-muted">
              {threadsLoading
                ? "Loading thread..."
                : isStaff
                ? "Select a member thread to start chatting."
                : "No chat thread available."}
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 bg-white border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <p className="font-ui text-sm text-muted">
                  {selectedMembership.community.name}
                </p>
                <h2 className="font-display text-lg text-ink">
                  {isGeneralThreadSelected
                    ? "General Announcements"
                    : isStaff
                    ? selectedStaffTarget?.displayName ||
                      selectedStaffTarget?.username ||
                      "Member"
                    : "Moderation Team"}
                </h2>
              </div>
              {isGeneralThreadSelected && (
                <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-ui font-medium">
                  All Members
                </span>
              )}
            </div>

            {isStaff && (
              <div className="md:hidden px-4 py-2 bg-white border-b border-black/[0.06]">
                <button
                  onClick={() => {
                    setSelectedThreadIdState(STAFF_GENERAL_THREAD_ID);
                    setSelectedStaffTarget(null);
                    setSendAsAppeal(false);
                  }}
                  className={`w-full mb-2 px-3 py-2 rounded-lg border font-ui text-sm transition-colors ${
                    selectedThreadId === STAFF_GENERAL_THREAD_ID
                      ? "bg-purple-primary/10 border-purple-primary/30 text-purple-primary"
                      : "bg-[#f5f5f5] border-black/[0.06] text-ink"
                  }`}
                >
                  General (All Members)
                </button>
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(event) => setMemberSearchQuery(event.target.value)}
                  placeholder="Search member thread..."
                  className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-black/[0.06] font-ui text-sm text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
                />
                {memberSearchQuery.trim().length >= 2 && (
                  <div className="mt-2 rounded-lg border border-black/[0.06] bg-white max-h-44 overflow-y-auto">
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
                          className="w-full text-left px-3 py-2 border-b border-black/[0.04] last:border-b-0 hover:bg-black/[0.02]"
                        >
                          <p className="font-ui text-sm text-ink truncate">
                            {member.profile?.display_name || member.profile?.username || "Member"}
                          </p>
                          <p className="font-ui text-xs text-muted truncate">
                            @{member.profile?.username || "unknown"}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {combinedError && (
              <div className="px-4 py-2 bg-red-50 text-red-600 font-ui text-sm">
                {combinedError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeMessagesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-body text-muted">
                    {isGeneralThreadSelected
                      ? "No announcements yet."
                      : "No messages yet."}
                  </p>
                </div>
              ) : (
                activeMessages.map((message, index) => {
                  const isOwn = message.sender_id === user.id;
                  const prev = index > 0 ? activeMessages[index - 1] : null;
                  const showDate =
                    !prev ||
                    new Date(prev.created_at).toDateString() !==
                      new Date(message.created_at).toDateString();

                  if (message.sender_role === "system") {
                    return (
                      <div key={message.id}>
                        {showDate && <DateDivider date={message.created_at} />}
                        <div className="flex justify-center py-1">
                          <div className="max-w-[80%] px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                            <p className="font-ui text-xs uppercase tracking-wide mb-1">
                              {message.message_type.replace(/_/g, " ")}
                            </p>
                            <p className="font-body text-sm leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id}>
                      {showDate && <DateDivider date={message.created_at} />}
                      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                            isOwn
                              ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-br-md"
                              : "bg-white border border-black/[0.06] text-ink rounded-bl-md"
                          }`}
                        >
                          {!isOwn && (
                            <p className="font-ui text-xs text-muted mb-1">
                              {message.sender_profile?.display_name ||
                                message.sender_profile?.username ||
                                "Moderator"}
                            </p>
                          )}
                          {message.message_type === "appeal" && (
                            <p
                              className={`font-ui text-[10px] uppercase tracking-wide mb-1 ${
                                isOwn ? "text-white/70" : "text-purple-primary"
                              }`}
                            >
                              Appeal
                            </p>
                          )}
                          {message.message_type === "announcement" && (
                            <p
                              className={`font-ui text-[10px] uppercase tracking-wide mb-1 ${
                                isOwn ? "text-white/70" : "text-blue-600"
                              }`}
                            >
                              Announcement
                            </p>
                          )}
                          {message.message_type === "mod_action" && (
                            <p
                              className={`font-ui text-[10px] uppercase tracking-wide mb-1 ${
                                isOwn ? "text-white/70" : "text-orange-600"
                              }`}
                            >
                              Moderation Update
                            </p>
                          )}
                          <p className="font-body text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          <p
                            className={`font-ui text-[11px] mt-1 ${
                              isOwn ? "text-white/70" : "text-muted"
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-black/[0.06]">
              {canAppeal && !isStaff && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    You can submit an appeal here.
                  </p>
                  <button
                    onClick={() => setSendAsAppeal((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-ui transition-colors ${
                      sendAsAppeal
                        ? "bg-purple-primary text-white"
                        : "bg-white text-ink border border-black/10 hover:bg-black/[0.03]"
                    }`}
                  >
                    {sendAsAppeal ? "Appeal Mode" : "Send Appeal"}
                  </button>
                </div>
              )}

              {isGeneralThreadSelected && (
                <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="font-ui text-xs text-blue-700">
                    Messages in this thread are sent to all community members.
                  </p>
                </div>
              )}

              {isGeneralThreadSelected && !canSendCommunityBroadcast && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    You do not have permission to send community-wide chat messages.
                  </p>
                </div>
              )}

              {!isStaff && !allowMemberModmail && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    Messaging the moderation team is currently disabled for members.
                  </p>
                </div>
              )}

              {!isStaff && allowMemberModmail && !allowMemberMessages && !sendAsAppeal && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    Regular member messages are disabled. Appeals are still available for muted or banned members.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    !canSendInCurrentThread
                      ? "Messaging is disabled for this thread."
                      : isGeneralThreadSelected
                      ? "Write an announcement for all members..."
                      : sendAsAppeal
                      ? "Write your appeal..."
                      : "Write a message..."
                  }
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#f5f5f5] border-none outline-none focus:ring-2 focus:ring-purple-primary/20 font-body text-sm"
                  disabled={!canSendInCurrentThread}
                />
                <button
                  onClick={handleSend}
                  disabled={!canSendInCurrentThread || !draft.trim() || isSending}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center disabled:opacity-50"
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
            </div>
          </>
        )}
      </section>
    </div>
  );
}
