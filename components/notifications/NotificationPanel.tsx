"use client";

import { useEffect, useMemo, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCollaborationInvites } from "@/lib/hooks.legacy";
import { useNotifications, useMarkAsRead } from "@/lib/hooks/useNotifications";
import { useFollowRequests } from "@/lib/hooks/useProfile";
import type { Notification } from "@/lib/types";
import { useAuth } from "@/components/providers/AuthProvider";
import { NotificationSkeleton } from "@/components/ui/Skeleton";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import "./notifications.css";
import Sheet from "@/components/ui/Sheet";
import { setRequestMetricsScope } from "@/lib/utils/requestMetrics";
import CollaborationInviteCard from "./CollaborationInviteCard";
import FollowRequestCard from "./FollowRequestCard";
import { CommentIcon, HeartIcon, RelayIcon, BookmarkIcon, icons as uiIcons } from "@/components/ui/Icons";
import { getTimeAgoCompact } from "@/lib/utils/time";
import { getMutedNotificationTypes } from "@/lib/utils/notificationCategories";
import { formatCurrency } from "@/lib/utils/currency";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/* One small monochrome mark per kind of event; the sentence carries the meaning. */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const kindIcons = {
  reaction: <HeartIcon size="sm" filled />,
  comment: <CommentIcon size="sm" />,
  relay: <RelayIcon size="sm" />,
  save: <BookmarkIcon size="sm" filled />,
  follow: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" /></svg>,
  community: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  mention: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M15 12v1.5a2.5 2.5 0 0 0 5 0V12a8 8 0 1 0-3.5 6.6" /></svg>,
  order: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M6 2h12l3 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7l3-5zM3 7h18M9 11a3 3 0 0 0 6 0" /></svg>,
  warning: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>,
  check: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
  clock: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
};

function getNotificationIcon(type: string) {
  if (["admire", "snap", "ovation", "support", "inspired", "applaud", "comment_like"].includes(type)) return kindIcons.reaction;
  if (type === "comment" || type === "reply") return kindIcons.comment;
  if (type === "relay") return kindIcons.relay;
  if (type === "save") return kindIcons.save;
  if (type.startsWith("follow")) return kindIcons.follow;
  if (type.startsWith("collaboration_")) return kindIcons.community;
  if (type === "mention") return kindIcons.mention;
  if (type === "community_muted" || type === "community_banned" || type === "community_warning") return kindIcons.warning;
  if (type.startsWith("community_")) return kindIcons.community;
  if (["order_completed", "order_paid", "order_accepted", "refund_approved", "order_refunded", "dispute_resolved", "extension_accepted"].includes(type)) return kindIcons.check;
  if (["order_due_soon", "order_due", "order_late", "extension_requested", "revision_requested"].includes(type)) return kindIcons.clock;
  if (["order_disputed", "chargeback_opened", "order_transfer_failed", "order_payment_failed", "refund_requested"].includes(type)) return kindIcons.warning;
  if (type.startsWith("order_") || type.startsWith("refund_") || type.startsWith("chargeback_") || type === "review_received") return kindIcons.order;
  return kindIcons.warning;
}

function getNotificationMessage(notification: Notification): { actor: string; action: string } {
  const actorName = notification.actor?.display_name || notification.actor?.username || "Someone";
  const communityName = notification.community?.name || "a community";
  const postType = notification.post?.type || 'post';

  switch (notification.type) {
    case 'admire':
      return { actor: actorName, action: `admired your ${postType}` };
    case 'snap':
      return { actor: actorName, action: `snapped for your ${postType}` };
    case 'ovation':
      return { actor: actorName, action: `gave a standing ovation to your ${postType}` };
    case 'support':
      return { actor: actorName, action: `showed support for your ${postType}` };
    case 'inspired':
      return { actor: actorName, action: `was inspired by your ${postType}` };
    case 'applaud':
      return { actor: actorName, action: `applauded your ${postType}` };
    case 'comment':
      return { actor: actorName, action: `commented on your ${postType}` };
    case 'reply':
      return { actor: actorName, action: 'replied to your comment' };
    case 'comment_like':
      return { actor: actorName, action: 'liked your comment' };
    case 'relay':
      return { actor: actorName, action: `relayed your ${postType}` };
    case 'save':
      return { actor: actorName, action: `saved your ${postType}` };
    case 'follow':
      return { actor: actorName, action: 'started following you' };
    case 'follow_request':
      return { actor: actorName, action: 'requested to follow you' };
    case 'follow_request_accepted':
      return { actor: actorName, action: 'accepted your follow request' };
    case 'community_invite':
      return { actor: actorName, action: `invited you to join ${communityName}` };
    case 'community_join_request':
      return { actor: actorName, action: `requested to join ${communityName}` };
    case 'community_join_approved':
      return { actor: 'Your request', action: `to join ${communityName} was approved` };
    case 'community_muted':
      return { actor: 'You were', action: `muted in ${communityName}` };
    case 'community_banned':
      return { actor: 'You were', action: `banned from ${communityName}` };
    case 'community_warning':
      return { actor: 'A moderator', action: `sent you a warning in ${communityName}` };
    case 'collaboration_invite':
      return { actor: actorName, action: `invited you to collaborate on their ${postType}` };
    case 'collaboration_accepted':
      return { actor: actorName, action: `accepted your collaboration invite` };
    case 'collaboration_declined':
      return { actor: actorName, action: `declined your collaboration invite` };
    case 'collaboration_removed':
      return { actor: actorName, action: `removed themselves from your ${postType}` };
    case 'mention':
      return { actor: actorName, action: `mentioned you in their ${postType}` };
    case 'order_pending_acceptance':
      return { actor: actorName, action: 'placed an order awaiting your approval' };
    case 'order_accepted':
      return { actor: actorName, action: 'accepted your order' };
    case 'order_declined':
      return { actor: actorName, action: 'declined your order' };
    case 'order_placed':
      return { actor: actorName, action: 'placed a new order' };
    case 'order_paid':
      return { actor: actorName, action: 'completed payment for your order' };
    case 'order_started':
      return { actor: actorName, action: 'started working on your order' };
    case 'order_delivered':
      return { actor: actorName, action: 'delivered your order' };
    case 'order_completed':
      return { actor: actorName, action: 'marked your order as completed' };
    case 'revision_requested':
      return { actor: actorName, action: 'requested a revision' };
    case 'order_cancelled':
      return { actor: actorName, action: 'cancelled the order' };
    case 'review_received':
      return { actor: actorName, action: 'left a review on your order' };
    case 'order_message':
      return { actor: actorName, action: 'sent a message in your order' };
    case 'order_disputed':
      return { actor: actorName, action: 'opened a dispute on your order' };
    case 'dispute_resolved':
      return { actor: 'Your dispute', action: 'has been resolved' };
    case 'refund_requested':
      return { actor: actorName, action: 'requested a refund on your order' };
    case 'order_refunded':
      return { actor: 'Your order', action: 'has been refunded' };
    case 'refund_declined':
      return { actor: actorName, action: 'declined the refund request' };
    case 'refund_approved':
      return { actor: 'Your refund', action: 'was approved and is on its way' };
    case 'order_cancel_requested':
      return { actor: actorName, action: 'asked to cancel the order' };
    case 'order_expired':
      return { actor: 'Checkout', action: 'expired before payment' };
    case 'order_payment_failed':
      return { actor: 'Your payment', action: "didn't go through" };
    case 'order_transfer_failed':
      return { actor: 'A payout', action: 'needs your attention' };
    case 'chargeback_opened':
      return { actor: "The buyer's bank", action: 'opened a chargeback' };
    case 'chargeback_closed':
      return { actor: 'The chargeback', action: 'was closed' };
    case 'order_due_soon':
      return { actor: 'Due tomorrow', action: 'less than a day left on this commission' };
    case 'order_due':
      return { actor: 'Due today', action: notification.metadata?.role === 'seller' ? "this commission is due and hasn't been delivered" : "your order was due and hasn't been delivered yet" };
    case 'order_late':
      return { actor: 'Running late', action: 'two days past the due date' };
    case 'extension_requested':
      return { actor: actorName, action: 'asked for more time' };
    case 'extension_accepted':
      return { actor: actorName, action: 'agreed to a new due date' };
    case 'extension_declined':
      return { actor: actorName, action: 'kept the original due date' };
    default:
      return { actor: actorName, action: 'has an update for you' };
  }
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onClose
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const router = useRouter();
  const opensCommunityInbox =
    notification.type === "community_join_approved" ||
    notification.type === "community_role_change" ||
    notification.type === "community_muted" ||
    notification.type === "community_banned";

  const getNotificationLink = (): string => {
    // Every order-linked notification opens the order page
    if (notification.order_id) return `/orders/${notification.order_id}`;
    if (notification.type === 'follow' ||
        notification.type === 'follow_request' ||
        notification.type === 'follow_request_accepted') {
      return notification.actor?.username ? `/studio/${notification.actor.username}` : '#';
    }
    if (notification.type === 'community_join_request' && notification.community?.slug) {
      // Link to the members settings page where admins can approve/reject
      return `/community/${notification.community.slug}/settings/members`;
    }
    if (opensCommunityInbox && notification.community?.slug) {
      return `/messages/community?community=${encodeURIComponent(notification.community.slug)}`;
    }
    if (notification.type.startsWith('community_') && notification.community?.slug) {
      return `/community/${notification.community.slug}`;
    }
    // Collaboration and mention notifications link to the post
    if (notification.type === 'collaboration_invite' ||
        notification.type === 'collaboration_accepted' ||
        notification.type === 'collaboration_declined' ||
        notification.type === 'collaboration_removed' ||
        notification.type === 'mention') {
      if (notification.post_id) {
        return `/post/${notification.post_id}`;
      }
    }
    // Reply and comment_like notifications link to post with comment anchor
    if ((notification.type === 'reply' || notification.type === 'comment_like') &&
        notification.post_id && notification.comment_id) {
      return `/post/${notification.post_id}?comment=${notification.comment_id}`;
    }
    if (notification.post_id) {
      return `/post/${notification.post_id}`;
    }
    return notification.actor?.username ? `/studio/${notification.actor.username}` : '#';
  };

  const notificationLink = getNotificationLink();

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!notification.read) {
      await onMarkAsRead(notification.id);
    }
    onClose();
    router.push(notificationLink);
  };

  const message = getNotificationMessage(notification);
  const isCommunityWarning = notification.type === "community_muted" || notification.type === "community_banned" || notification.type === "community_warning";
  const showPreview =
    ((notification.type === "comment" || notification.type === "reply" || notification.type === "comment_like") && notification.content) ||
    (isCommunityWarning && notification.content) ||
    (notification.type === "community_join_request" && notification.content) ||
    (notification.order_id && notification.content);
  const postPreview = notification.post && notification.type !== "follow" && !notification.type.startsWith("community_") && !notification.order_id && !notification.content
    ? (notification.post.title || notification.post.content?.substring(0, 80) || "")
    : "";

  return (
    <Link href={notificationLink} onClick={handleClick} className={`pq-notif ${notification.read ? "" : "pq-notif--unread"}`}>
      <span className="pq-notif__avatar" aria-hidden="true">
        <img src={notification.actor?.avatar_url || DEFAULT_AVATAR} alt="" />
        <span className="pq-notif__kind">{getNotificationIcon(notification.type)}</span>
      </span>
      <div className="pq-notif__text">
        <p className="pq-notif__line"><strong>{message.actor}</strong> {message.action}{notification.type.startsWith("community_") && notification.community ? "" : ""}</p>
        {showPreview && <p className="pq-notif__preview">{notification.content}</p>}
        {notification.order_id && notification.metadata && (notification.metadata.order_number || notification.metadata.title) && (
          <p className="pq-notif__facts">
            {[notification.metadata.order_number, notification.metadata.amount != null ? formatCurrency(Number(notification.metadata.amount), notification.metadata.currency ?? undefined) : null, notification.metadata.title].filter(Boolean).join(" · ")}
          </p>
        )}
        {postPreview && <p className="pq-notif__preview">{postPreview}</p>}
        <p className="pq-notif__when">
          {getTimeAgoCompact(notification.created_at)}
          {notification.type.startsWith("community_") && notification.community ? ` · ${notification.community.name}` : ""}
          {!notification.read ? " · New" : ""}
        </p>
      </div>
    </Link>
  );
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  if (!isOpen) return null;
  return <NotificationPanelContent onClose={onClose} />;
}

function NotificationPanelContent({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const mutedNotificationTypes = useMemo(() => getMutedNotificationTypes(profile?.notification_preferences), [profile?.notification_preferences]);
  const { notifications, loading } = useNotifications(user?.id, mutedNotificationTypes);
  const { markAsRead, markAllAsRead } = useMarkAsRead();
  const { invites: rawInvites, accept: acceptInvite, decline: declineInvite } = useCollaborationInvites(user?.id || "");
  const invites = rawInvites.filter((invite) => invite.post && invite.post.author);
  const { requests: followRequests, accept: acceptFollowRequest, decline: declineFollowRequest } = useFollowRequests(user?.id);
  const regularNotifications = notifications.filter((n) => n.type !== "collaboration_invite" && n.type !== "follow_request");
  const regularUnreadCount = regularNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    setRequestMetricsScope("notifications");
    return () => setRequestMetricsScope(null);
  }, []);

  // Opening the panel counts as seeing everything: the badge clears, the "New" words stay until the next open.
  useEffect(() => {
    if (!user?.id) return;
    void markAllAsRead(user.id);
  }, [user?.id, markAllAsRead]);

  const unreadCount = regularUnreadCount + invites.length + followRequests.length;
  const hasContent = regularNotifications.length > 0 || invites.length > 0 || followRequests.length > 0;

  return (
    <Sheet
      isOpen
      onClose={onClose}
      presentation="panel"
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} new since you last looked` : hasContent ? "Recent activity around your work" : undefined}
      bodyClassName="pq-dialog__body--flush"
      footer={
        <Link href="/settings/notifications" onClick={onClose} className="pq-button pq-button--sm pq-button--ghost">
          Notification settings
        </Link>
      }
    >
      {loading ? (
        <div className="p-3 grid gap-1" aria-busy="true">
          {[...Array(5)].map((_, i) => <NotificationSkeleton key={i} />)}
        </div>
      ) : !hasContent ? (
        <div className="pq-chat-empty">
          <span className="pq-thread-row__mark" aria-hidden="true">{uiIcons.heart}</span>
          <h3>Nothing new</h3>
          <p>When someone reacts, replies, follows or orders, it shows up here.</p>
        </div>
      ) : (
        <div className="pq-notifs">
          {followRequests.length > 0 && (
            <section aria-labelledby="notifs-follow">
              <h3 id="notifs-follow" className="pq-notifs__section">Asking to follow you <span className="pq-tab__count">{followRequests.length}</span></h3>
              {followRequests.map((request) => (
                <FollowRequestCard key={request.follower_id} request={request} onAccept={acceptFollowRequest} onDecline={declineFollowRequest} />
              ))}
            </section>
          )}
          {invites.length > 0 && (
            <section aria-labelledby="notifs-collab">
              <h3 id="notifs-collab" className="pq-notifs__section">Collaboration invites <span className="pq-tab__count">{invites.length}</span></h3>
              {invites.map((invite) => (
                <CollaborationInviteCard key={invite.id} invite={invite} onAccept={async (postId, authorId) => { await acceptInvite(postId, authorId); }} onDecline={async (postId, authorId) => { await declineInvite(postId, authorId); }} />
              ))}
            </section>
          )}
          {regularNotifications.length > 0 && (followRequests.length > 0 || invites.length > 0) && (
            <h3 className="pq-notifs__section">Activity</h3>
          )}
          {regularNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onMarkAsRead={markAsRead} onClose={onClose} />
          ))}
        </div>
      )}
    </Sheet>
  );
}
