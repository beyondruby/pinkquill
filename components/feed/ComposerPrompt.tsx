"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { NavIcon } from "@/components/layout/navigation";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";

/**
 * A quiet invitation at the top of Home for signed-in people. It only links to
 * the existing composer; the media icons say "photo, video and sound are
 * welcome too" without adding a new creation path.
 */
export default function ComposerPrompt() {
  const { user, profile } = useAuth();
  if (!user) return null;

  return (
    <Link href="/create" className="pq-composer-prompt" aria-label="Create a post">
      <img
        src={getOptimizedAvatarUrl(profile?.avatar_url) || DEFAULT_AVATAR}
        alt=""
        className="pq-avatar"
        width={36}
        height={36}
      />
      <span className="pq-composer-prompt__text">What are you making, feeling, or figuring out?</span>
      <span className="pq-composer-prompt__media" aria-hidden="true">
        <NavIcon name="image" />
        <NavIcon name="video" />
        <NavIcon name="music" />
      </span>
    </Link>
  );
}
