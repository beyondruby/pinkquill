"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useCommunityAnnouncements, useCommunityChatActions, useCommunityChatMemberSearch, useCommunityChatOverview, useCommunityChatMemberships, useCommunityChatMessages, useCommunityChatThreads } from "@/lib/hooks/useCommunityChat";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import { showToast } from "@/lib/utils/toast";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { NavIcon } from "@/components/layout/navigation";
import { icons as uiIcons } from "@/components/ui/Icons";
import { PageFrame } from "@/components/layout/PageFrame";
import "../messages.css";

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

function DateDivider({ date }: { date: string }) {
  return <div className="pq-chat-day"><span>{formatDateDivider(date)}</span></div>;
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
  if (messageType === "mod_action") return "From the moderators";
  if (messageType === "status_update") return "Membership update";
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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [staffMessageMode, setStaffMessageMode] = useState<"message" | "announcement">("message");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");

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
    setStaffMessageMode("message");
  }, [selectedCommunityId]);

  useEffect(() => {
    setStaffMessageMode("message");
  }, [selectedThreadId]);

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
      <PageFrame width="narrow">
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Sign in to see community chat</p>
          <div className="pq-feed-state__actions">
            <Link href="/login?redirect=%2Fmessages%2Fcommunity" className="pq-button pq-button--md pq-button--primary">Sign in</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  const combinedError = membershipsError || overviewError || memberSearchError || threadsError || activeError;

  const welcomeMessage = selectedMembership?.community.welcome_message?.trim() || null;
  const communityName = selectedMembership?.community.name || "";
  const communityAvatar = selectedMembership?.community.avatar_url || DEFAULT_AVATAR;
  const communitySlug = selectedMembership?.community.slug || "";

  const headerTitle = isCommunityThreadSelected
    ? communityName
    : isStaff
      ? selectedStaffTarget?.displayName || selectedStaffTarget?.username || "Member"
      : "The moderators";
  const headerSubtitle = isCommunityThreadSelected
    ? "Community chat"
    : isStaff
      ? `@${selectedStaffTarget?.username || "unknown"}`
      : `Private thread · ${communityName}`;

  const showLeaveAction = isCommunityThreadSelected && !isStaff && isCommunityChatJoined && selectedMembership?.status === "active";
  const showJoinCTA = isCommunityThreadSelected && !isStaff && !isCommunityChatJoined && isChatEnabled;

  const inputDisabledReason = !isChatEnabled
    ? "The admins have turned community chat off."
    : isCommunityThreadSelected
      ? isStaff
        ? canSendCommunityBroadcast ? null : "You can read here, but posting to the community needs the chat permission."
        : selectedMembership?.status !== "active"
          ? "You can read, but not post, while your membership is restricted."
          : !allowMemberMessages ? "Members can read this chat; only staff post right now." : null
      : !allowMemberModmail ? "Messaging the moderators is off in this community." : null;

  const inlineHint =
    isCommunityThreadSelected && isStaff && canSendCommunityBroadcast
      ? staffMessageMode === "announcement" ? "Everyone who joined the chat gets this as an announcement." : "Everyone in the chat can see this."
      : isCommunityThreadSelected && !isStaff && isCommunityChatJoined && allowMemberMessages
        ? "Everyone in the chat can see this."
        : !isCommunityThreadSelected && !isStaff && !sendAsAppeal && allowMemberModmail
          ? "Only the moderators can see this."
          : !isCommunityThreadSelected && !isStaff && sendAsAppeal
            ? "Sent as an appeal to the moderators."
            : null;

  const roleWord = (role: string) => (role === "admin" ? "Admin" : role === "moderator" ? "Moderator" : null);
  const statusWord = (status: string) => (status === "muted" ? "Muted" : status === "banned" ? "Banned" : null);

  const chooseCommunity = (communityId: string) => {
    setSelectedCommunityIdState(communityId);
    setSelectedThreadIdState(null);
    setSendAsAppeal(false);
    setMobilePane("thread");
  };
  const chooseCommunityThread = () => {
    setSelectedThreadIdState(COMMUNITY_THREAD_ID);
    setSelectedStaffTarget(null);
    setSendAsAppeal(false);
    setMobilePane("thread");
  };
  const chooseModThread = () => {
    if (!memberDirectThreadId) return;
    setSelectedThreadIdState(memberDirectThreadId);
    setSendAsAppeal(false);
    setMobilePane("thread");
  };

  const memberSearch = (compact = false) => (
    <div className={compact ? "grid gap-2" : "grid gap-2 px-4 py-3 border-b border-line"}>
      <input
        type="search"
        value={memberSearchQuery}
        onChange={(event) => setMemberSearchQuery(event.target.value)}
        placeholder="Find a member"
        aria-label="Find a member"
        className="pq-field pq-field--ui"
      />
      {memberSearchQuery.trim().length >= 2 && (
        memberSearchLoading ? (
          <div className="pq-discussion__state" role="status" aria-label="Searching"><Spinner size="sm" /></div>
        ) : memberSearchResults.length === 0 ? (
          <p className="pq-discussion__state">No members match.</p>
        ) : (
          <div className="pq-list">
            {memberSearchResults.slice(0, compact ? 5 : 20).map((member) => (
              <button key={member.user_id} type="button" className="pq-thread-row" style={{ minBlockSize: "3.25rem" }} onClick={() => { openStaffThreadForMember(member); setMobilePane("thread"); }}>
                <img src={member.profile?.avatar_url || DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover" />
                <span className="pq-thread-row__text">
                  <span className="pq-thread-row__name">{member.profile?.display_name || member.profile?.username || "Member"}</span>
                  <span className="pq-thread-row__preview"><span>@{member.profile?.username || "unknown"}</span>{statusWord(member.status) && <span className="pq-thread-row__word">{statusWord(member.status)}</span>}</span>
                </span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );

  return (
    <div className="pq-msgs" data-open={mobilePane}>
      {/* Communities */}
      <aside className="pq-msgs__list" aria-label="Your communities">
        <div className="pq-msgs__head">
          <Link href="/messages" className="pq-icon-button -ml-1" aria-label="Back to messages"><NavIcon name="back" /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="pq-msgs__title">Community chat</h1>
            <p className="pq-msgs__sub">One thread per community you&rsquo;re in</p>
          </div>
        </div>

        {membershipsLoading || (overviewLoading && memberships.length === 0) ? (
          <div className="pq-chat-empty" role="status" aria-label="Loading"><Spinner size="lg" /></div>
        ) : sortedMemberships.length === 0 ? (
          <div className="pq-chat-empty">
            <h3>No communities yet</h3>
            <p>Join one and its chat shows up here.</p>
            <Link href="/community" className="pq-button pq-button--md pq-button--primary">Browse communities</Link>
          </div>
        ) : (
          <div className="pq-msgs__scroll" role="list">
            {sortedMemberships.map(({ membership, unreadCount }) => {
              const isSelected = membership.community_id === selectedCommunityId;
              const words = [roleWord(membership.role), statusWord(membership.status)].filter(Boolean).join(" · ");
              return (
                <button key={membership.community_id} type="button" role="listitem" onClick={() => chooseCommunity(membership.community_id)} aria-current={isSelected ? "true" : undefined} className={`pq-thread-row ${unreadCount > 0 ? "pq-thread-row--unread" : ""}`}>
                  <img src={membership.community.avatar_url || DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-[0.75rem] object-cover" />
                  <span className="pq-thread-row__text">
                    <span className="pq-thread-row__top"><span className="pq-thread-row__name">{membership.community.name}</span></span>
                    <span className="pq-thread-row__preview">
                      <span>{words || "Member"}</span>
                      {unreadCount > 0 && <span className="pq-thread-row__unread">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Channels for the chosen community: below the list on phones, its own pane on desktop */}
        {selectedMembership && (
          <div className="md:hidden border-t border-line">
            <p className="pq-msgs__section">In {communityName}</p>
            <button type="button" className="pq-thread-row" aria-current={selectedThreadId === COMMUNITY_THREAD_ID ? "true" : undefined} onClick={chooseCommunityThread}>
              <span className="pq-thread-row__mark"><NavIcon name="people" /></span>
              <span className="pq-thread-row__text"><span className="pq-thread-row__name">Community chat</span></span>
            </button>
            {!isStaff && (
              <button type="button" className="pq-thread-row" aria-current={selectedThreadId === memberDirectThreadId ? "true" : undefined} onClick={chooseModThread}>
                <span className="pq-thread-row__mark">{uiIcons.flag}</span>
                <span className="pq-thread-row__text"><span className="pq-thread-row__name">The moderators</span><span className="pq-thread-row__preview"><span>Just you and them</span></span></span>
              </button>
            )}
            {isStaff && <div className="px-4 py-3">{memberSearch(true)}</div>}
          </div>
        )}
      </aside>

      {/* Channels (desktop) */}
      {selectedMembership && (
        <aside className="pq-msgs__list pq-msgs__list--channels hidden md:flex" aria-label={`Threads in ${communityName}`}>
          <div className="pq-msgs__head"><p className="pq-msgs__title text-base">{communityName}</p></div>
          <button type="button" className="pq-thread-row" aria-current={selectedThreadId === COMMUNITY_THREAD_ID ? "true" : undefined} onClick={chooseCommunityThread}>
            <span className="pq-thread-row__mark"><NavIcon name="people" /></span>
            <span className="pq-thread-row__text">
              <span className="pq-thread-row__name">Community chat</span>
              <span className="pq-thread-row__preview"><span>{isStaff ? "Everyone in the community" : isCommunityChatJoined ? "You're in" : "Not joined yet"}</span></span>
            </span>
          </button>
          {!isStaff && (
            <button type="button" className="pq-thread-row" aria-current={selectedThreadId === memberDirectThreadId ? "true" : undefined} onClick={chooseModThread}>
              <span className="pq-thread-row__mark">{uiIcons.flag}</span>
              <span className="pq-thread-row__text">
                <span className="pq-thread-row__name">The moderators</span>
                <span className="pq-thread-row__preview"><span>Just you and them</span></span>
              </span>
            </button>
          )}
          {isStaff && (
            <>
              {memberSearch()}
              <div className="pq-msgs__scroll">
                {threads.filter((t) => t.last_message_at).length > 0 && !memberSearchQuery.trim() && (
                  <>
                    <p className="pq-msgs__section">Member threads</p>
                    {threads.filter((t) => t.last_message_at).map((thread) => {
                      const profile = thread.member_profile;
                      const isSelected = selectedThreadId !== COMMUNITY_THREAD_ID && selectedStaffTarget?.memberId === thread.member_id;
                      return (
                        <button
                          key={`thread-${thread.id}`}
                          type="button"
                          aria-current={isSelected ? "true" : undefined}
                          className={`pq-thread-row ${thread.has_unread ? "pq-thread-row--unread" : ""}`}
                          onClick={() => {
                            setSelectedThreadIdState(thread.id);
                            setSelectedStaffTarget({ threadId: thread.id, memberId: thread.member_id, status: "active", username: profile?.username || "unknown", displayName: profile?.display_name || null, avatarUrl: profile?.avatar_url || null });
                            setSendAsAppeal(false);
                          }}
                        >
                          <img src={profile?.avatar_url || DEFAULT_AVATAR} alt="" className="w-9 h-9 rounded-full object-cover" />
                          <span className="pq-thread-row__text">
                            <span className="pq-thread-row__name">{profile?.display_name || profile?.username || "Member"}</span>
                            <span className="pq-thread-row__preview"><span>@{profile?.username || "unknown"}</span>{thread.has_unread && <span className="pq-thread-row__word">New</span>}</span>
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      )}

      {/* Thread */}
      <section className="pq-msgs__thread" aria-label={headerTitle}>
        {!selectedMembership ? (
          <div className="pq-chat-empty">
            <h2>Pick a community</h2>
            <p>Choose one from the list to open its chat.</p>
          </div>
        ) : !isChatEnabled ? (
          <>
            <div className="pq-chat-head">
              <button type="button" onClick={() => setMobilePane("list")} className="pq-icon-button md:hidden -ml-1" aria-label="Back to communities"><NavIcon name="back" /></button>
              <div className="pq-chat-head__who"><h2 className="pq-chat-head__name">{communityName}</h2></div>
            </div>
            <div className="pq-chat-empty">
              <h2>Chat is off here</h2>
              <p>The admins of {communityName} have turned community chat off for now.</p>
            </div>
          </>
        ) : !selectedThreadId ? (
          <div className="pq-chat-empty" role="status">
            {threadsLoading ? <Spinner size="lg" /> : <p>{isStaff ? "Pick a member thread to start." : "No thread here yet."}</p>}
          </div>
        ) : (
          <>
            <div className="pq-chat-head">
              <button type="button" onClick={() => setMobilePane("list")} className="pq-icon-button md:hidden -ml-1" aria-label="Back to communities"><NavIcon name="back" /></button>
              {isCommunityThreadSelected ? (
                <Link href={`/community/${communitySlug}`} className="pq-chat-head__who">
                  <img src={communityAvatar} alt="" className="w-10 h-10 rounded-[0.75rem] object-cover" />
                  <div className="min-w-0"><h2 className="pq-chat-head__name">{headerTitle}</h2><p className="pq-chat-head__meta">{headerSubtitle}</p></div>
                </Link>
              ) : isStaff && selectedStaffTarget ? (
                <Link href={`/studio/${selectedStaffTarget.username}`} className="pq-chat-head__who">
                  <img src={selectedStaffTarget.avatarUrl || DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div className="min-w-0"><h2 className="pq-chat-head__name">{headerTitle}</h2><p className="pq-chat-head__meta">{headerSubtitle}</p></div>
                </Link>
              ) : (
                <div className="pq-chat-head__who">
                  <span className="pq-thread-row__mark">{uiIcons.flag}</span>
                  <div className="min-w-0"><h2 className="pq-chat-head__name">{headerTitle}</h2><p className="pq-chat-head__meta">{headerSubtitle}</p></div>
                </div>
              )}
              <ActionMenu
                label={headerTitle}
                description={headerSubtitle}
                widthClassName="w-60"
                buttonAriaLabel="Chat options"
                buttonClassName="pq-icon-button"
                portal
                items={[
                  { label: "Open the community", href: `/community/${communitySlug}` },
                  { label: "Settings", href: `/community/${communitySlug}/settings`, hidden: !(isStaff && isCommunityThreadSelected), sectionLabel: "Manage", icon: uiIcons.edit },
                  { label: "Leave community chat", onSelect: () => setShowLeaveConfirm(true), hidden: !showLeaveAction, tone: "danger", dividerBefore: true },
                ]}
              />
            </div>

            {combinedError && <p className="pq-alert m-3" role="alert">{combinedError}</p>}

            <div className="pq-chat-log">
              {showJoinCTA ? (
                <div className="pq-chat-empty">
                  <img src={communityAvatar} alt="" className="w-16 h-16 rounded-[1rem] object-cover" />
                  <h3>Welcome to {communityName}</h3>
                  <p>{welcomeMessage || "Join the chat to read announcements and talk with everyone here."}</p>
                  <Button variant="primary" onClick={() => handleJoinCommunityChat(true)} disabled={updatingJoinState || selectedMembership.status !== "active"} loading={updatingJoinState} loadingText="Joining…">Join the chat</Button>
                  {selectedMembership.status !== "active" && <p>Your membership is {selectedMembership.status} right now.</p>}
                </div>
              ) : activeMessagesLoading ? (
                <div className="pq-chat-empty" role="status" aria-label="Loading"><Spinner size="lg" /></div>
              ) : activeMessages.length === 0 ? (
                <div className="pq-chat-empty">
                  <img src={isCommunityThreadSelected || !isStaff ? communityAvatar : selectedStaffTarget?.avatarUrl || DEFAULT_AVATAR} alt="" className="w-16 h-16 rounded-full object-cover" />
                  {isCommunityThreadSelected ? (
                    <>
                      <h3>Welcome to {communityName}</h3>
                      <p>{welcomeMessage || (isStaff ? "Write the first message to greet the community." : "Be the first to say something here.")}</p>
                    </>
                  ) : (
                    <>
                      <h3>{isStaff ? selectedStaffTarget?.displayName || selectedStaffTarget?.username : "The moderators"}</h3>
                      <p>{isStaff ? "Start a private thread with this member." : "Write privately to the moderators of this community."}</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {isCommunityThreadSelected && welcomeMessage && (
                    <p className="pq-chat-note"><strong>Welcome</strong>{welcomeMessage}</p>
                  )}
                  {activeMessages.map((message, index) => {
                    const isOwn = message.sender_id === user.id;
                    const prev = index > 0 ? activeMessages[index - 1] : null;
                    const showDate = !prev || new Date(prev.created_at).toDateString() !== new Date(message.created_at).toDateString();
                    const senderRole = message.sender_role || "member";
                    const senderName = message.sender_profile?.display_name || message.sender_profile?.username || (senderRole === "member" ? "A member" : "A moderator");
                    const senderUsername = message.sender_profile?.username;
                    const senderAvatar = message.sender_profile?.avatar_url;

                    if (isSystemMessage(message.message_type, senderRole)) {
                      return (
                        <div key={message.id} className="grid">
                          {showDate && <DateDivider date={message.created_at} />}
                          <p className="pq-chat-note"><strong>{getSystemLabel(message.message_type)}</strong>{message.content}</p>
                        </div>
                      );
                    }

                    const isAnnouncement = isCommunityThreadSelected && message.message_type === "announcement";
                    return (
                      <div key={message.id}>
                        {showDate && <DateDivider date={message.created_at} />}
                        <div className={`pq-chat-line ${isOwn ? "pq-chat-line--own" : ""}`}>
                          {!isOwn && (
                            senderUsername ? (
                              <Link href={`/studio/${senderUsername}`} className="pq-chat-line__avatar" aria-label={senderName}>
                                {senderAvatar ? <img src={senderAvatar} alt="" /> : senderName.charAt(0).toUpperCase()}
                              </Link>
                            ) : (
                              <span className="pq-chat-line__avatar" aria-hidden="true">{senderName.charAt(0).toUpperCase()}</span>
                            )
                          )}
                          <div className="pq-chat-line__stack">
                            {!isOwn && (
                              <p className="pq-chat-line__sender">
                                <span>{senderName}</span>
                                {roleWord(senderRole) && <span>· {roleWord(senderRole)}</span>}
                              </p>
                            )}
                            <div className={`pq-bubble ${isAnnouncement ? "pq-bubble--announcement" : ""}`}>
                              {isAnnouncement && <span className="pq-bubble__label">Announcement</span>}
                              {message.message_type === "appeal" && <span className="pq-bubble__label">Appeal</span>}
                              <p className="pq-bubble__text">{message.content}</p>
                              <div className="pq-bubble__foot"><span>{formatTime(message.created_at)}</span></div>
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

            {!showJoinCTA && (
              <div className="pq-chat-compose">
                {inputDisabledReason ? (
                  <p className="pq-chat-compose__off">{inputDisabledReason}</p>
                ) : (
                  <>
                    {canToggleAnnouncement && (
                      <div className="flex items-center justify-center">
                        <div className="pq-segmented" role="radiogroup" aria-label="Send as">
                          <button type="button" role="radio" aria-checked={staffMessageMode === "message"} className="pq-segmented__option" onClick={() => setStaffMessageMode("message")}>Message</button>
                          <button type="button" role="radio" aria-checked={staffMessageMode === "announcement"} className="pq-segmented__option" onClick={() => setStaffMessageMode("announcement")}>Announcement</button>
                        </div>
                      </div>
                    )}
                    {inlineHint && <p className="pq-chat-compose__hint">{inlineHint}</p>}
                    <div className="pq-chat-compose__row">
                      {canAppeal && (
                        <button type="button" onClick={() => setSendAsAppeal((prev) => !prev)} className="pq-chip" aria-pressed={sendAsAppeal}>
                          Appeal
                        </button>
                      )}
                      <div className="pq-chat-compose__field">
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
                              ? "Write the announcement"
                              : isCommunityThreadSelected
                                ? `Message ${communityName}`
                                : sendAsAppeal
                                  ? "Write your appeal"
                                  : isStaff
                                    ? "Reply to this member"
                                    : "Message the moderators"
                          }
                          aria-label="Message"
                          disabled={!canSendInCurrentThread}
                        />
                      </div>
                      <button type="button" className="pq-chat-compose__send" onClick={handleSend} disabled={!canSendInCurrentThread || !draft.trim() || isSending} aria-label={staffMessageMode === "announcement" && canToggleAnnouncement ? "Send announcement" : "Send"}>
                        {isSending ? <Spinner size="sm" /> : uiIcons.send}
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
        description={`You'll stop seeing and sending messages in ${communityName}'s chat. You can rejoin from this thread any time.`}
        confirmText="Leave chat"
        cancelText="Stay"
        isDanger
        loading={updatingJoinState}
      />
    </div>
  );
}
