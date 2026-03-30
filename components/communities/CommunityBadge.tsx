"use client";

import React from "react";
import Link from "next/link";

interface CommunityBadgeProps {
  community: {
    slug: string;
    name: string;
    avatar_url?: string | null;
  };
  size?: 'sm' | 'md';
  showAvatar?: boolean;
}

export default function CommunityBadge({ community, size = 'sm', showAvatar = true }: CommunityBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  const avatarSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <Link
      href={`/community/${community.slug}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-full bg-purple-primary/10 text-purple-primary hover:bg-purple-primary/20 transition-colors font-ui font-medium ${sizeClasses[size]}`}
    >
      {showAvatar && (
        <div className={`${avatarSizes[size]} rounded-full overflow-hidden flex-shrink-0`}>
          {community.avatar_url ? (
            <img
              src={community.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-[0.5rem] font-bold">
              {community.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <span className="truncate max-w-[120px]">{community.name}</span>
    </Link>
  );
}
