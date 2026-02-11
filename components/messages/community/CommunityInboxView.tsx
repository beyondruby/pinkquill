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
  }, [selectedCommunityId]);

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

  const handleSend = async () => {
    if (!draft.trim()) return;
    if (!selectedMembership) return;
    if (!canSendInCurrentThread) return;

    if (isCommunityThreadSelected) {
      if (isStaff) {
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

      const result = await postCommunityMessage(selectedMembership.community_id, draft);
      if (!result.success) {
        showToast.error("Message failed", result.error);
        return;
      }

      showToast.success("Sent", "Your message was posted to community chat.");
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

      {/* Thread list */}
      {selectedMembership && (
        <aside className="hidden md:flex w-[280px] border-r border-black/[0.06] bg-white flex-col">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <p className="font-ui text-xs uppercase tracking-wide text-muted">Threads</p>
          </div>

          <button
            onClick={() => {
              setSelectedThreadIdState(COMMUNITY_THREAD_ID);
              setSelectedStaffTarget(null);
              setSendAsAppeal(false);
            }}
            className={`w-full text-left px-4 py-3 border-b border-black/[0.04] transition-colors ${
              selectedThreadId === COMMUNITY_THREAD_ID
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
                <p className="font-ui text-sm text-ink font-medium truncate">Community Chat</p>
                <p className="font-ui text-xs text-muted truncate">
                  {isStaff ? "Community-wide updates and discussion" : "Join to participate"}
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
              className={`w-full text-left px-4 py-3 border-b border-black/[0.04] transition-colors ${
                selectedThreadId === memberDirectThreadId
                  ? "bg-purple-primary/8"
                  : "hover:bg-black/[0.02]"
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
                  <p className="font-ui text-xs text-muted truncate">Private thread with moderators</p>
                </div>
              </div>
            </button>
          )}

          {isStaff && (
            <>
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
                {staffRecentThreads.length > 0 && (
                  <div className="border-b border-black/[0.06]">
                    <p className="px-4 py-2 font-ui text-[11px] uppercase tracking-wide text-muted">
                      Recent Threads
                    </p>
                    {staffRecentThreads.map((thread) => {
                      const isSelected =
                        selectedThreadId !== COMMUNITY_THREAD_ID &&
                        selectedStaffTarget?.memberId === thread.memberId;

                      return (
                        <button
                          key={`recent-${thread.memberId}`}
                          onClick={() => {
                            setSelectedThreadIdState(thread.threadId);
                            setSelectedStaffTarget(thread);
                            setSendAsAppeal(false);
                          }}
                          className={`w-full text-left px-4 py-3 border-t border-black/[0.04] transition-colors ${
                            isSelected ? "bg-purple-primary/8" : "hover:bg-black/[0.02]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={thread.avatarUrl || DEFAULT_AVATAR}
                              alt={thread.username}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-ui text-sm text-ink truncate">
                                {thread.displayName || thread.username}
                              </p>
                              <p className="font-ui text-xs text-muted truncate">@{thread.username}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {memberSearchQuery.trim().length < 2 ? (
                  <div className="p-4">
                    <p className="font-ui text-sm text-muted">
                      Search a member to start a new direct thread.
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
                      selectedThreadId !== COMMUNITY_THREAD_ID &&
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
            </>
          )}
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
                  {isCommunityThreadSelected
                    ? "Community Chat"
                    : isStaff
                    ? selectedStaffTarget?.displayName ||
                      selectedStaffTarget?.username ||
                      "Member"
                    : "Moderation Team"}
                </h2>
              </div>
              {isCommunityThreadSelected && (
                <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-ui font-medium">
                  {isStaff ? "All Joined Members" : isCommunityChatJoined ? "Joined" : "Not Joined"}
                </span>
              )}
            </div>

            {selectedMembership && (
              <div className="md:hidden px-4 py-2 bg-white border-b border-black/[0.06]">
                <button
                  onClick={() => {
                    setSelectedThreadIdState(COMMUNITY_THREAD_ID);
                    setSelectedStaffTarget(null);
                    setSendAsAppeal(false);
                  }}
                  className={`w-full mb-2 px-3 py-2 rounded-lg border font-ui text-sm transition-colors ${
                    selectedThreadId === COMMUNITY_THREAD_ID
                      ? "bg-purple-primary/10 border-purple-primary/30 text-purple-primary"
                      : "bg-[#f5f5f5] border-black/[0.06] text-ink"
                  }`}
                >
                  Community Chat
                </button>
                {isStaff ? (
                  <>
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(event) => setMemberSearchQuery(event.target.value)}
                      placeholder="Search member thread..."
                      className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-black/[0.06] font-ui text-sm text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
                    />
                    {staffRecentThreads.length > 0 && (
                      <div className="mt-2 rounded-lg border border-black/[0.06] bg-white">
                        {staffRecentThreads.slice(0, 5).map((thread) => (
                          <button
                            key={`mobile-recent-${thread.memberId}`}
                            onClick={() => {
                              setSelectedThreadIdState(thread.threadId);
                              setSelectedStaffTarget(thread);
                              setSendAsAppeal(false);
                            }}
                            className="w-full text-left px-3 py-2 border-b border-black/[0.04] last:border-b-0 hover:bg-black/[0.02]"
                          >
                            <p className="font-ui text-sm text-ink truncate">
                              {thread.displayName || thread.username}
                            </p>
                            <p className="font-ui text-xs text-muted truncate">@{thread.username}</p>
                          </button>
                        ))}
                      </div>
                    )}
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
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (memberDirectThreadId) {
                        setSelectedThreadIdState(memberDirectThreadId);
                        setSendAsAppeal(false);
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border font-ui text-sm transition-colors ${
                      selectedThreadId === memberDirectThreadId
                        ? "bg-purple-primary/10 border-purple-primary/30 text-purple-primary"
                        : "bg-[#f5f5f5] border-black/[0.06] text-ink"
                    }`}
                  >
                    Moderation Team
                  </button>
                )}
              </div>
            )}

            {combinedError && (
              <div className="px-4 py-2 bg-red-50 text-red-600 font-ui text-sm">
                {combinedError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isCommunityThreadSelected && !isStaff && !isCommunityChatJoined ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-body text-muted max-w-sm text-center">
                    Join this community chat thread to start receiving and sending community messages.
                  </p>
                </div>
              ) : activeMessagesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-body text-muted">
                    {isCommunityThreadSelected
                      ? "No community messages yet."
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
                                (message.sender_role === "member" ? "Community Member" : "Moderator")}
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

              {isCommunityThreadSelected && (
                <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="font-ui text-xs text-blue-700">
                    {isStaff
                      ? "Messages in this thread are shared with joined community members."
                      : "This is the community-wide chat thread."}
                  </p>
                </div>
              )}

              {isCommunityThreadSelected && !isStaff && !isCommunityChatJoined && (
                <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="font-ui text-xs text-blue-700">
                    Join community chat to view and participate in this thread.
                  </p>
                  <button
                    onClick={() => handleJoinCommunityChat(true)}
                    disabled={updatingJoinState || selectedMembership.status !== "active"}
                    className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-ui disabled:opacity-50"
                  >
                    {updatingJoinState ? "Joining..." : "Join"}
                  </button>
                </div>
              )}

              {isCommunityThreadSelected && !isStaff && isCommunityChatJoined && (
                <div className="mb-2 rounded-lg bg-black/[0.03] border border-black/[0.06] px-3 py-2 flex items-center justify-between gap-2">
                  <p className="font-ui text-xs text-muted">
                    You are participating in community chat.
                  </p>
                  <button
                    onClick={() => handleJoinCommunityChat(false)}
                    disabled={updatingJoinState}
                    className="px-2.5 py-1 rounded-full bg-white text-ink border border-black/10 text-[11px] font-ui disabled:opacity-50"
                  >
                    {updatingJoinState ? "Updating..." : "Leave"}
                  </button>
                </div>
              )}

              {isCommunityThreadSelected && isStaff && !canSendCommunityBroadcast && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    You do not have permission to send community-wide chat messages.
                  </p>
                </div>
              )}

              {!isStaff && !isCommunityThreadSelected && !allowMemberModmail && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    Messaging the moderation team is currently disabled for members.
                  </p>
                </div>
              )}

              {!isStaff && isCommunityThreadSelected && isCommunityChatJoined && !allowMemberMessages && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    Members can currently read community chat, but posting is disabled.
                  </p>
                </div>
              )}

              {!isStaff && !isCommunityThreadSelected && allowMemberModmail && !sendAsAppeal && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="font-ui text-xs text-amber-800">
                    This thread goes directly to the moderation team.
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
                      : isCommunityThreadSelected
                      ? isStaff
                        ? "Write an update for community chat..."
                        : "Write a message for community chat..."
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
