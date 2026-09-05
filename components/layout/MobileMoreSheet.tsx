"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import { QuickThemeToggle } from "@/components/theme/QuickThemeToggle";
import Sheet from "@/components/ui/Sheet";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";
import { NavIcon, formatCount, isDestinationActive, moreSheetDestinations } from "./navigation";

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Every destination that is not in the phone bottom bar, grouped, on the
 * shared Sheet. Signed-in people also get their account, appearance, and
 * log out; guests get the public destinations and help.
 */
export default function MobileMoreSheet({ isOpen, onClose }: MobileMoreSheetProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { cartCount, unreadMessages } = useBadgeCounts();

  const ctx = { signedIn: !!user, username: profile?.username };
  const items = moreSheetDestinations(ctx);
  const displayName = profile?.display_name || profile?.username || "";

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="More" bodyClassName="pq-dialog__body--flush">
      {user && profile && (
        <Link href={`/studio/${profile.username}`} onClick={onClose} className="pq-account" aria-label={`${displayName}, open my studio`}>
          <img src={getOptimizedAvatarUrl(profile.avatar_url) || DEFAULT_AVATAR} alt="" className="pq-avatar pq-avatar--lg" width={48} height={48} />
          <span className="pq-account__text">
            <span className="pq-account__name">{displayName}</span>
            <span className="pq-account__handle">@{profile.username} · My studio</span>
          </span>
          <NavIcon name="back" className="pq-account__more rotate-180" />
        </Link>
      )}

      <nav className="pq-nav-list" aria-label="More destinations">
        {items.map((dest, index) => {
          const previous = items[index - 1];
          const showGroup = dest.group && dest.group !== previous?.group;
          const count = dest.badge === "cart" ? cartCount : dest.badge === "messages" ? unreadMessages : 0;
          return (
            <div key={dest.id}>
              {showGroup && <p className="pq-nav-list__group">{dest.group}</p>}
              <Link
                href={dest.href}
                onClick={onClose}
                className="pq-nav-link"
                aria-current={isDestinationActive(dest, pathname) ? "page" : undefined}
                aria-label={count > 0 && dest.badge === "messages" ? `${dest.label}, ${count} unread` : undefined}
              >
                <NavIcon name={dest.icon} />
                <span className="pq-nav-link__label">{dest.label}</span>
                {count > 0 && <span className="pq-count pq-count--live" aria-hidden="true">{formatCount(count)}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {user && (
        <>
          <div className="pq-menu__divider" role="separator" />
          <QuickThemeToggle />
          <div className="pq-menu__divider" role="separator" />
          <button
            type="button"
            className="pq-nav-link pq-nav-link--danger"
            onClick={() => {
              onClose();
              void signOut();
            }}
          >
            <NavIcon name="logout" />
            <span className="pq-nav-link__label">Log out</span>
          </button>
        </>
      )}
    </Sheet>
  );
}
