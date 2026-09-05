import Link from "next/link";
import type { ReactNode } from "react";
import FlairBadge from "@/components/communities/FlairBadge";
import { PostTypeChip } from "@/components/feed/PostTypeChip";
import type { DetailPost, DetailTone } from "./types";

interface PostDetailHeaderProps {
  post: DetailPost;
  tone: DetailTone;
  /** Back or close control, rendered before the creator. */
  leading?: ReactNode;
  /** Discussion toggle, menu, … rendered after the creator. */
  trailing?: ReactNode;
  onNavigate?: () => void;
  /** Replaces the post-type chip (Takes: "shared a take"). */
  typeLabel?: ReactNode;
}

/** Creator row: who made this, what kind of work, when. */
export default function PostDetailHeader({ post, tone, leading, trailing, onNavigate, typeLabel }: PostDetailHeaderProps) {
  const handle = post.author.handle.replace(/^@/, "");
  return (
    <div className="pq-detail__creator">
      {leading}
      <Link href={`/studio/${handle}`} onClick={onNavigate} className="shrink-0" aria-label={`${post.author.name}'s studio`}>
        <img src={post.author.avatar} alt="" className="pq-avatar" width={40} height={40} />
      </Link>
      <div className="pq-detail__who">
        <div className="pq-detail__name-line">
          <Link href={`/studio/${handle}`} onClick={onNavigate} className={`pq-detail__name ${tone.text}`}>
            {post.author.name}
          </Link>
          {post.flair && <FlairBadge flair={post.flair} size="sm" />}
        </div>
        <div className={`pq-detail__meta ${tone.muted}`}>
          {typeLabel ? <span>{typeLabel}</span> : <PostTypeChip type={post.type} variant="label" size="sm" className="text-inherit" />}
          <span aria-hidden="true">·</span>
          <span>{post.timeAgo}</span>
        </div>
      </div>
      {trailing && <div className="pq-detail__tools">{trailing}</div>}
    </div>
  );
}
