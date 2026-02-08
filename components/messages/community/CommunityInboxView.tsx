"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  useCommunityChatActions,
  useCommunityChatMemberships,
  useCommunityChatMessages,
  useCommunityChatThreads,
  type CommunityChatThread,
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

function getThreadDisplayName(thread: CommunityChatThread): string {
  return (
    thread.member_profile?.display_name ||
    thread.member_profile?.username ||
    "Member"
  );
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

  const [selectedCommunityIdState, setSelectedCommunityIdState] = useState<string | null>(null);
  const [selectedThreadIdState, setSelectedThreadIdState] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendAsAppeal, setSendAsAppeal] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState(false);

  const selectedCommunityId = useMemo(() => {
    if (memberships.length === 0) return null;
    if (
      selectedCommunityIdState &&
      memberships.some((m) => m.community_id === selectedCommunityIdState)
    ) {
      return selectedCommunityIdState;
    }

    const byQuery = requestedCommunity
      ? memberships.find((m) => m.community.slug === requestedCommunity)
      : undefined;

    return byQuery?.community_id || memberships[0].community_id;
  }, [memberships, requestedCommunity, selectedCommunityIdState]);

  const selectedMembership = useMemo(
    () => memberships.find((m) => m.community_id === selectedCommunityId) || null,
    [memberships, selectedCommunityId]
  );

  const isStaff =
    selectedMembership?.role === "admin" ||
    selectedMembership?.role === "moderator";

  const {
    threads,
    loading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useCommunityChatThreads(
    selectedCommunityId || "",
    user?.id,
    isStaff
  );

  const selectedThreadId = useMemo(() => {
    if (!selectedCommunityId || threads.length === 0) return null;
    if (
      selectedThreadIdState &&
      threads.some((thread) => thread.id === selectedThreadIdState)
    ) {
      return selectedThreadIdState;
    }
    return threads[0].id;
  }, [selectedCommunityId, threads, selectedThreadIdState]);

  const {
    messages,
    loading: messagesLoading,
    sending,
    error: messagesError,
    sendMessage,
  } = useCommunityChatMessages(selectedThreadId || "", user?.id);

  const { broadcasting, broadcastToCommunity } = useCommunityChatActions();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  const canAppeal =
    !!selectedMembership &&
    selectedMembership.role === "member" &&
    (selectedMembership.status === "muted" || selectedMembership.status === "banned");

  const handleSend = async () => {
    if (!draft.trim()) return;
    if (!selectedMembership) return;

    if (isStaff && broadcastMode) {
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
      setBroadcastMode(false);
      await refetchThreads();
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

  const combinedError = membershipsError || threadsError || messagesError;

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

        {membershipsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
          </div>
        ) : memberships.length === 0 ? (
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
            {memberships.map((membership) => {
              const isSelected = membership.community_id === selectedCommunityId;
              return (
                <button
                  key={membership.community_id}
                  onClick={() => {
                    setSelectedCommunityIdState(membership.community_id);
                    setSelectedThreadIdState(null);
                    setBroadcastMode(false);
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
                      <p className="font-ui text-sm text-ink font-medium truncate">
                        {membership.community.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-ui uppercase ${getRoleBadgeClass(
                            membership.role
                          )}`}
                        >
                          {membership.role}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-ui uppercase ${getStatusBadgeClass(
                            membership.status
                          )}`}
                        >
                          {membership.status}
                        </span>
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
            <p className="font-ui text-xs uppercase tracking-wide text-muted">Member Threads</p>
          </div>
          {threadsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex-1 p-4">
              <p className="font-ui text-sm text-muted">No member threads yet.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadIdState(thread.id)}
                  className={`w-full text-left px-4 py-3 border-b border-black/[0.04] transition-colors ${
                    thread.id === selectedThreadId
                      ? "bg-purple-primary/8"
                      : "hover:bg-black/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={thread.member_profile?.avatar_url || DEFAULT_AVATAR}
                      alt={thread.member_profile?.username || "Member"}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-ui text-sm text-ink truncate">
                        {getThreadDisplayName(thread)}
                      </p>
                      <p className="font-ui text-xs text-muted truncate">
                        @{thread.member_profile?.username || "unknown"}
                      </p>
                    </div>
                    {thread.last_message_at && (
                      <span className="font-ui text-[11px] text-muted">
                        {formatDate(thread.last_message_at)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* Chat */}
      <section className="flex-1 flex flex-col">
        {!selectedMembership ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-body text-muted">Select a community to open chat.</p>
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
                  {isStaff
                    ? selectedThread
                      ? getThreadDisplayName(selectedThread)
                      : "Member"
                    : "Moderation Team"}
                </h2>
              </div>
              {isStaff && (
                <button
                  onClick={() => setBroadcastMode((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-full text-xs font-ui transition-colors ${
                    broadcastMode
                      ? "bg-purple-primary text-white"
                      : "bg-black/[0.04] text-ink hover:bg-black/[0.08]"
                  }`}
                >
                  {broadcastMode ? "Broadcasting" : "Broadcast"}
                </button>
              )}
            </div>

            {isStaff && (
              <div className="md:hidden px-4 py-2 bg-white border-b border-black/[0.06]">
                {threadsLoading ? (
                  <p className="font-ui text-xs text-muted">Loading member threads...</p>
                ) : threads.length === 0 ? (
                  <p className="font-ui text-xs text-muted">No member threads yet.</p>
                ) : (
                  <select
                    value={selectedThreadId || threads[0].id}
                    onChange={(e) => setSelectedThreadIdState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-black/[0.06] font-ui text-sm text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
                  >
                    {threads.map((thread) => (
                      <option key={thread.id} value={thread.id}>
                        {getThreadDisplayName(thread)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {combinedError && (
              <div className="px-4 py-2 bg-red-50 text-red-600 font-ui text-sm">
                {combinedError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messagesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-body text-muted">No messages yet.</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.sender_id === user.id;
                  const prev = index > 0 ? messages[index - 1] : null;
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

              {isStaff && broadcastMode && (
                <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="font-ui text-xs text-blue-700">
                    Broadcast mode: this message will be sent to every member thread in this community.
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
                    isStaff && broadcastMode
                      ? "Write a broadcast update..."
                      : sendAsAppeal
                      ? "Write your appeal..."
                      : "Write a message..."
                  }
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#f5f5f5] border-none outline-none focus:ring-2 focus:ring-purple-primary/20 font-body text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending || broadcasting}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center disabled:opacity-50"
                >
                  {sending || broadcasting ? (
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
