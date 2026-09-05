"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import { QuickThemeToggle } from "@/components/theme/QuickThemeToggle";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";
import {
  CREATE_CHOICES,
  NavIcon,
  countLabel,
  formatCount,
  isDestinationActive,
  moreMenuDestinations,
  railDestinations,
} from "./navigation";

/**
 * The stable desktop rail. Always the same width (no hover expansion), every
 * destination labelled, search lives in the top bar. Guests see the public
 * destinations and a sign-in action; signed-in people also get Create, the
 * personal tools menu, and their account.
 */
export default function DesktopRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const { unreadMessages, cartCount } = useBadgeCounts();

  const ctx = { signedIn: !!user, username: profile?.username };
  const destinations = railDestinations(ctx);
  const moreItems: ActionMenuItem[] = moreMenuDestinations(ctx).map((dest) => ({
    label: dest.label,
    href: dest.href,
    icon: <NavIcon name={dest.icon} className="w-[18px] h-[18px]" />,
    sectionLabel: dest.group,
    meta: dest.badge === "cart" && cartCount > 0 ? <span className="pq-count pq-count--live">{formatCount(cartCount)}</span> : undefined,
  }));
  const createItems: ActionMenuItem[] = CREATE_CHOICES.map((choice) => ({
    label: choice.label,
    description: choice.description,
    icon: <NavIcon name={choice.icon} className="w-[18px] h-[18px]" />,
    onSelect: () => router.push(choice.href),
  }));

  const displayName = profile?.display_name || profile?.username || "";

  return (
    <nav className="pq-rail" aria-label="Main navigation">
      <Link href="/" className="pq-brand" aria-label="Pinkquill home">
        <img src="/icon.svg" alt="" className="pq-brand__mark" width={30} height={30} />
        <span>pinkquill<span className="pq-brand__dot">.</span></span>
      </Link>
      <p className="pq-rail__tagline">Show your colors.</p>

      <div className="pq-rail__nav">
        {destinations.map((dest) => {
          const active = isDestinationActive(dest, pathname);
          const count = dest.badge === "messages" ? unreadMessages : 0;
          return (
            <Link
              key={dest.id}
              href={dest.href}
              className="pq-nav-link"
              aria-current={active ? "page" : undefined}
              aria-label={count > 0 ? countLabel(dest.label, count) : undefined}
            >
              <NavIcon name={dest.icon} />
              <span className="pq-nav-link__label">{dest.label}</span>
              {count > 0 && <span className="pq-count pq-count--live" aria-hidden="true">{formatCount(count)}</span>}
            </Link>
          );
        })}
      </div>

      {user && (
        <div className="pq-rail__create">
          <ActionMenu
            items={createItems}
            label="Create"
            widthClassName="w-64"
            portal
            align="start"
            placement="top"
            buttonAriaLabel="Create"
            buttonClassName="pq-button pq-button--md pq-button--primary pq-button--full"
            trigger={<><NavIcon name="plus" className="w-[18px] h-[18px]" /><span>Create</span></>}
          />
        </div>
      )}

      <div className="pq-rail__foot">
        <p className="pq-rail__note" aria-hidden="true">
          <span>✳</span>
          <span>There&rsquo;s room for<br />your kind of creative.</span>
        </p>

        {loading || (user && !profile) ? (
          <div className="pq-account" aria-hidden="true">
            <span className="pq-avatar pq-skeleton" />
            <span className="pq-account__text">
              <span className="pq-skeleton block h-3 w-24 mb-1.5" />
              <span className="pq-skeleton block h-2.5 w-16" />
            </span>
          </div>
        ) : user && profile ? (
          <div className="pq-account-row">
            <Link href={`/studio/${profile.username}`} className="pq-account" aria-label={`${displayName}, open my studio`}>
              <img
                src={getOptimizedAvatarUrl(profile.avatar_url) || DEFAULT_AVATAR}
                alt=""
                className="pq-avatar"
                width={36}
                height={36}
              />
              <span className="pq-account__text">
                <span className="pq-account__name">{displayName}</span>
                <span className="pq-account__handle">@{profile.username}</span>
              </span>
            </Link>
            <ActionMenu
              items={moreItems}
              label="More"
              widthClassName="w-64"
              portal
              align="start"
              placement="top"
              buttonAriaLabel="More"
              buttonClassName="pq-icon-button"
              trigger={<NavIcon name="more" className="w-5 h-5" />}
              footer={(close) => (
                <>
                  <QuickThemeToggle />
                  <div className="pq-menu__divider" role="separator" />
                  <button
                    type="button"
                    className="pq-menu__item pq-menu__item--danger"
                    onClick={() => {
                      close();
                      void signOut();
                    }}
                  >
                    <span className="pq-menu__icon"><NavIcon name="logout" className="w-[18px] h-[18px]" /></span>
                    <span className="pq-menu__text"><span className="pq-menu__label">Log out</span></span>
                  </button>
                </>
              )}
            />
          </div>
        ) : (
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname)}`}
            className="pq-button pq-button--md pq-button--secondary pq-button--full"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
