"use client";

import Link from "next/link";
import Image from "next/image";
import ActionMenu from "@/components/ui/ActionMenu";
import { CommentIcon } from "@/components/ui/Icons";
import { DEFAULT_AVATAR } from "@/lib/posts/toPostProps";
import { getTimeAgo } from "@/lib/utils/time";
import type { Take } from "@/lib/hooks/useTakes";
import type { TakeDetailActions } from "./useTakeDetailActions";

interface Props {
  take: Take;
  actions: TakeDetailActions;
  /** Desktop "Discussion" toggle with the count badge (the modal only). */
  discussion?: { onToggle: () => void };
  /** Mobile back chevron (the modal only, V-42). */
  onBack?: () => void;
  className?: string;
}

/** Author row with Follow and the options menu, shared by the take modal and page (V-4). */
export function TakeDetailHeader({ take, actions, discussion, onBack, className = "" }: Props) {
  const { user, isOwner, followStatus, toggleFollow, menuItems, commentsCount, onNavigate } = actions;
  const name = take.author.display_name || take.author.username;
  const isFollowing = followStatus === "accepted";
  return (
    <div className={`take-detail-header post-detail-header flex items-center gap-3 md:gap-4 ${className}`}>
      {onBack && (
        <button onClick={onBack} aria-label="Close take" className="md:hidden w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-ink hover:bg-skeleton transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <Link href={`/studio/${take.author.username}`} onClick={onNavigate} className="flex-shrink-0">
        <Image
          src={take.author.avatar_url || DEFAULT_AVATAR}
          alt={name}
          width={56}
          height={56}
          className="post-detail-avatar w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 md:border-[3px] border-white shadow-lg hover:scale-110 transition-transform"
          sizes="56px"
          quality={80}
        />
      </Link>
      <div className="post-detail-author flex flex-col gap-0.5 md:gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/studio/${take.author.username}`} onClick={onNavigate} className="post-detail-name font-ui text-[1rem] md:text-[1.1rem] font-medium text-ink hover:text-accent transition-colors truncate max-w-full">
            {name}
          </Link>
          <span className="font-ui text-[0.85rem] md:text-[0.9rem] font-light text-muted">shared a take</span>
        </div>
        <span className="post-detail-time font-ui text-[0.8rem] md:text-[0.85rem] text-muted">{getTimeAgo(take.created_at)}</span>
      </div>

      {!isOwner && user && (
        <button
          onClick={toggleFollow}
          className={`px-4 py-1.5 rounded-full font-ui text-sm font-medium transition-colors ${
            isFollowing ? "bg-skeleton/70 text-ink hover:bg-skeleton" : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:scale-105"
          }`}
        >
          {isFollowing ? "Following" : followStatus === "pending" ? "Requested" : "Follow"}
        </button>
      )}

      {discussion && (
        <button onClick={discussion.onToggle} className="view-discussion-btn">
          <CommentIcon className="shrink-0" />
          <span>Discussion</span>
          <span className="badge">{commentsCount}</span>
        </button>
      )}

      {menuItems.length > 0 && (
        <ActionMenu
          items={menuItems}
          buttonClassName="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/60 transition-colors"
          widthClassName="w-40"
          buttonAriaLabel="Take options menu"
        />
      )}
    </div>
  );
}
