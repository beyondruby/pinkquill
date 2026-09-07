"use client";

import { useState } from "react";
import Link from "next/link";
import { getOptimizedAvatarUrl } from "@/lib/utils/image";
import { supabase } from "@/lib/supabase";
import { actionToast } from "@/lib/utils/toast";
import type { EngagementKind } from "@/lib/engagement/store";

interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Collaborator {
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PostTagsProps {
  hashtags?: string[];
  mentions?: TaggedUser[];
  collaborators?: Collaborator[];
  className?: string;
  onNavigate?: () => void;
  /** With `contentId` + `currentUserId`, a tagged viewer gets "Remove me". */
  kind?: EngagementKind;
  contentId?: string;
  currentUserId?: string | null;
}

export default function PostTags({
  hashtags = [],
  mentions: mentionsProp = [],
  collaborators = [],
  className = "",
  onNavigate,
  kind = "post",
  contentId,
  currentUserId,
}: PostTagsProps) {
  const [expanded, setExpanded] = useState(false);
  const [removedSelf, setRemovedSelf] = useState(false);
  const [removing, setRemoving] = useState(false);

  const mentions = removedSelf && currentUserId ? mentionsProp.filter((m) => m.id !== currentUserId) : mentionsProp;
  const taggedSelf = !!currentUserId && !!contentId && mentions.some((m) => m.id === currentUserId);

  const removeSelf = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!contentId || removing) return;
    setRemoving(true);
    const { error } = await supabase.rpc("remove_self_mention", { p_kind: kind, p_content_id: contentId });
    setRemoving(false);
    if (error) {
      actionToast.genericError("remove tag");
      return;
    }
    setRemovedSelf(true);
  };

  const hasHashtags = hashtags.length > 0;
  const hasMentions = mentions.length > 0;
  const hasCollaborators = collaborators.length > 0;

  if (!hasHashtags && !hasMentions && !hasCollaborators) return null;

  const handleClick = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <div className={`post-meta-section ${className}`}>
      {/* Collaborators - Creative chip design */}
      {hasCollaborators && (
        <div className="collab-chips">
          <span className="collab-chips-label">Created with</span>
          <div className="collab-chips-list">
            {collaborators.map((collab) => (
              <Link
                key={collab.user.id}
                href={`/studio/${collab.user.username}`}
                className="collab-chip"
                onClick={handleClick}
              >
                <div className="collab-chip-avatar">
                  {collab.user.avatar_url ? (
                    <img src={getOptimizedAvatarUrl(collab.user.avatar_url)} alt={collab.user.display_name || collab.user.username} loading="lazy" />
                  ) : (
                    <span className="collab-chip-avatar-fallback">
                      {(collab.user.display_name || collab.user.username)[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="collab-chip-info">
                  <span className="collab-chip-name">
                    {collab.user.display_name || collab.user.username}
                  </span>
                  {collab.role && (
                    <span className="collab-chip-role">{collab.role}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tagged People - Minimal inline style */}
      {hasMentions && (
        <div className="tagged-section">
          <svg className="tagged-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span className="tagged-names">
            {mentions.slice(0, expanded ? mentions.length : 3).map((user, i) => (
              <span key={user.id}>
                {i > 0 && <span className="tagged-sep">·</span>}
                <Link href={`/studio/${user.username}`} className="tagged-link" onClick={handleClick}>
                  {user.display_name || user.username}
                </Link>
              </span>
            ))}
            {!expanded && mentions.length > 3 && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }} className="tagged-more">
                +{mentions.length - 3}
              </button>
            )}
            {taggedSelf && (
              <button
                type="button"
                onClick={removeSelf}
                disabled={removing}
                className="ml-2 font-ui text-[0.72rem] text-muted hover:text-pink-vivid transition-colors disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove me"}
              </button>
            )}
          </span>
        </div>
      )}

      {/* Hashtags - Subtle pills */}
      {hasHashtags && (
        <div className="hashtags-section">
          {hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag)}`}
              className="hashtag-pill"
              onClick={handleClick}
            >
              <span className="hashtag-hash">#</span>{tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
