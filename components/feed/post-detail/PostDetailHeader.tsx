"use client";

import Link from "next/link";
import Image from "next/image";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import FlairBadge from "@/components/communities/FlairBadge";
import { PostTypeChip } from "@/components/feed/PostTypeChip";
import { icons } from "@/components/ui/Icons";
import type { ModalPost } from "@/components/feed/PostCard/types";
import type { PostPalette } from "./palette";

interface Props {
  post: ModalPost;
  palette: PostPalette;
  menuItems: ActionMenuItem[];
  /** Fires when a link in the header is followed (the modal closes itself). */
  onNavigate?: () => void;
  /** Mobile back chevron (the modal only). */
  onBack?: () => void;
  /** Desktop "Discussion" toggle with the count badge (the modal only). */
  discussion?: { count: number; onToggle: () => void };
  className?: string;
}

/** Author row shared by the detail modal and the post page (V-52, V-4). */
export function PostDetailHeader({ post, palette, menuItems, onNavigate, onBack, discussion, className = "" }: Props) {
  const { hasBackground, hasDarkBg, text, muted } = palette;
  const handle = post.author.handle.replace("@", "");
  return (
    <div className={`post-detail-header flex items-center gap-3 md:gap-4 ${hasBackground && hasDarkBg ? "is-dark" : ""} ${className}`}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Close post"
          className={`md:hidden w-10 h-10 -ml-1 rounded-full flex items-center justify-center transition-colors ${
            hasBackground ? (hasDarkBg ? "text-white hover:bg-white/10" : "text-[#1e1e1e] hover:bg-black/10") : "text-ink hover:bg-skeleton"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <Link href={`/studio/${handle}`} onClick={onNavigate}>
        <Image
          src={post.author.avatar}
          alt={post.author.name}
          width={56}
          height={56}
          className={`post-detail-avatar w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 md:border-[3px] shadow-lg hover:scale-110 transition-transform ${
            hasDarkBg ? "border-surface/30" : "border-white"
          }`}
          sizes="56px"
          quality={80}
        />
      </Link>
      <div className="post-detail-author flex flex-col gap-0.5 md:gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/studio/${handle}`}
            onClick={onNavigate}
            className={`post-detail-name font-ui text-[0.95rem] md:text-[1.1rem] font-medium transition-colors truncate ${
              hasBackground ? `${text} hover:opacity-80` : "text-ink hover:text-accent"
            }`}
          >
            {post.author.name}
          </Link>
          {post.flair && <FlairBadge flair={post.flair} size="sm" />}
          <span className={`font-ui text-[0.8rem] md:text-[0.9rem] font-light hidden sm:inline ${muted}`}>
            <PostTypeChip type={post.type} variant="label" size="md" className="text-inherit" />
          </span>
        </div>
        <span className={`post-detail-time font-ui text-[0.75rem] md:text-[0.85rem] ${muted}`}>{post.timeAgo}</span>
      </div>
      {discussion && (
        <button
          onClick={discussion.onToggle}
          className={`view-discussion-btn hidden md:flex ${hasDarkBg ? "bg-surface/10 text-white hover:bg-surface/20" : ""}`}
        >
          {icons.comment}
          <span>Discussion</span>
          <span className={`badge ${hasDarkBg ? "bg-surface/20" : ""}`}>{discussion.count}</span>
        </button>
      )}
      {menuItems.length > 0 && (
        <ActionMenu
          items={menuItems}
          buttonClassName={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            hasBackground
              ? hasDarkBg
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-[#4a4a4a] hover:text-[#1e1e1e] hover:bg-black/10"
              : "text-muted hover:text-ink hover:bg-skeleton/60"
          }`}
          widthClassName="w-40"
          buttonAriaLabel="Post options menu"
        />
      )}
    </div>
  );
}
