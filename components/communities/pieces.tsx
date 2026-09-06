"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getOptimizedAvatarUrl } from "@/lib/utils/image";
import type { Community } from "@/lib/types";
import "./communities.css";

/* ---- People ------------------------------------------------------------ */

export interface PersonLike {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export function personName(p: PersonLike | null | undefined): string {
  return p?.display_name || p?.username || "Someone";
}

export function PersonAvatar({ person, size = "md" }: { person: PersonLike | null | undefined; size?: "sm" | "md" }) {
  const cls = `pq-person__avatar ${size === "sm" ? "pq-person__avatar--sm" : ""}`.trim();
  const src = person?.avatar_url ? getOptimizedAvatarUrl(person.avatar_url) : null;
  return (
    <span className={cls} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : personName(person).charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * One person in a list: avatar, name (a link to their studio), handle, an
 * optional word about them (role, status) and whatever sits at the end.
 */
export function PersonRow({
  person,
  word,
  meta,
  trailing,
  children,
}: {
  person: PersonLike | null | undefined;
  /** Short status word shown beside the name: "Admin", "Muted". */
  word?: ReactNode;
  /** Secondary line under the handle. */
  meta?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  const handle = person?.username;
  return (
    <div className="pq-person">
      <div className="pq-person__row">
        <PersonAvatar person={person} />
        <div className="pq-person__text">
          <div className="pq-person__name-line">
            {handle ? (
              <Link href={`/studio/${handle}`} className="pq-person__name">{personName(person)}</Link>
            ) : (
              <span className="pq-person__name">{personName(person)}</span>
            )}
            {word && <span className="pq-person__word">{word}</span>}
          </div>
          {handle && <p className="pq-person__handle">@{handle}</p>}
          {meta && <p className="pq-person__meta">{meta}</p>}
        </div>
        {trailing && <div className="pq-person__trailing">{trailing}</div>}
      </div>
      {children}
    </div>
  );
}

export function roleWord(role: string | null | undefined): string | null {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return null;
}

export function formatDay(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", withTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

/* ---- Settings frame ---------------------------------------------------- */

interface SettingsSection {
  href: string;
  label: string;
  adminOnly?: boolean;
  exact?: boolean;
}

export function settingsSections(slug: string): SettingsSection[] {
  const base = `/community/${slug}`;
  return [
    { href: `${base}/settings`, label: "Overview", exact: true },
    { href: `${base}/settings/general`, label: "General" },
    { href: `${base}/settings/rules`, label: "Rules" },
    { href: `${base}/settings/chat`, label: "Chat" },
    { href: `${base}/settings/flairs`, label: "Flairs", adminOnly: true },
    { href: `${base}/settings/members`, label: "Roles and requests", adminOnly: true },
    { href: `${base}/settings/moderation`, label: "Moderation log" },
    { href: `${base}/mod`, label: "Reports" },
  ];
}

/**
 * One local navigation for everything a moderator or admin does: a side list
 * from 1024px, a scrolling tab row below. Pages render their content beside it.
 */
export function CommunitySettingsFrame({
  community,
  title,
  lede,
  actions,
  children,
}: {
  community: Community;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = community.user_role === "admin";
  const sections = settingsSections(community.slug).filter((s) => !s.adminOnly || isAdmin);
  return (
    <div className="pq-settings-layout">
      <nav className="pq-settings-nav" aria-label="Community settings">
        <div className="pq-tabs pq-settings-nav__tabs">
          {sections.map((section) => {
            const active = section.exact ? pathname === section.href : pathname.startsWith(section.href);
            return (
              <Link key={section.href} href={section.href} className="pq-tab" aria-selected={active} aria-current={active ? "page" : undefined}>
                {section.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <section className="pq-settings-content" aria-labelledby="settings-title">
        <header className="pq-settings-head">
          <div className="min-w-0">
            <h2 id="settings-title" className="pq-settings-title">{title}</h2>
            {lede && <p className="pq-settings-lede">{lede}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </section>
    </div>
  );
}

/** Inline outcome of a save or a moderation action. */
export function Notice({ tone = "success", children }: { tone?: "success" | "danger"; children: ReactNode }) {
  return (
    <p className={`pq-notice pq-notice--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </p>
  );
}
