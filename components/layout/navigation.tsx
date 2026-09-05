import type { ReactElement } from "react";
import { isProtectedPath } from "@/lib/auth/protected-paths";

/**
 * Pinkquill 2.0 navigation registry — the one list of destinations that the
 * desktop rail, the phone bottom bar, the More sheet and the Create menu all
 * read from. Labels, routes and gating live here; components only lay them out.
 *
 * Nothing here adds a destination the product does not already have.
 */

export type NavIconName =
  | "home" | "compass" | "people" | "shop" | "takes" | "message" | "studio" | "orders"
  | "more" | "plus" | "search" | "bell" | "save" | "bag" | "collab" | "chart" | "seller"
  | "settings" | "help" | "logout" | "quill" | "product" | "service" | "back" | "close"
  | "image" | "video" | "music";

const PATHS: Record<NavIconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM16 8l-3 5-5 3 3-5 5-3Z",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  shop: "M3 9h18l-2-6H5L3 9ZM4 9v12h16V9M9 21v-7h6v7M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0",
  takes: "M4 6h16v13H4V6ZM4 6l2-3h12l2 3M10 10l5 3-5 3v-6",
  message: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a8.5 8.5 0 1 1 16.1-4Z",
  studio: "M3 21h18M5 21V9l7-6 7 6v12M9 21v-8h6v8M9 9h6",
  orders: "M7 3h10v4H7V3ZM7 5H4v17h16V5h-3M8 12h8M8 16h5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  save: "M5 3h14v19l-7-5-7 5V3Z",
  bag: "M4 7h16l1 15H3L4 7ZM8 7V5a4 4 0 0 1 8 0v2",
  collab: "M17 2l4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3",
  chart: "M4 21V10M12 21V3M20 21v-7",
  seller: "M3 3h7v7H3V3ZM14 3h7v4h-7V3ZM14 10h7v11h-7V10ZM3 13h7v8H3v-8Z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  quill: "M20 4c-6 0-11 4-13 10l-4 6M20 4c0 6-4 11-10 13M9 15h6",
  product: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  service: "M9 7h8M9 11h5M9 15h6M21 17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8Z",
  back: "M19 12H5M11 6l-6 6 6 6",
  close: "M6 6l12 12M18 6 6 18",
  image: "M3 3h18v18H3V3ZM3 16l5-5 4 4 4-5 5 6M8 7h.01",
  video: "M3 5h13v14H3V5ZM16 9l6-4v14l-6-4",
  music: "M9 18V5l12-3v13M9 18a3 3 0 1 1-3-3h3M21 15a3 3 0 1 1-3-3h3",
};

export function NavIcon({ name, className = "" }: { name: NavIconName; className?: string }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type BadgeKey = "messages" | "cart" | "notifications";

export interface NavDestination {
  id: string;
  label: string;
  href: string;
  icon: NavIconName;
  /** How the current pathname marks this item active. */
  match: "exact" | "prefix";
  /** Live count shown beside the label. */
  badge?: BadgeKey;
  /** Group heading in the More sheet/menu. */
  group?: "Discover" | "Library" | "Creator" | "Support";
}

export interface NavContext {
  signedIn: boolean;
  username?: string | null;
}

/** Everything the app can navigate to from its chrome, in one place. */
export const DESTINATIONS = {
  home: { id: "home", label: "Home", href: "/", icon: "home", match: "exact" },
  explore: { id: "explore", label: "Explore", href: "/explore", icon: "compass", match: "prefix" },
  communities: { id: "communities", label: "Communities", href: "/community", icon: "people", match: "prefix", group: "Discover" },
  shop: { id: "shop", label: "Shop", href: "/shop", icon: "shop", match: "prefix", group: "Discover" },
  takes: { id: "takes", label: "Takes", href: "/takes", icon: "takes", match: "prefix" },
  messages: { id: "messages", label: "Messages", href: "/messages", icon: "message", match: "prefix", badge: "messages", group: "Discover" },
  studio: { id: "studio", label: "My studio", href: "/settings/profile", icon: "studio", match: "prefix", group: "Discover" },
  orders: { id: "orders", label: "Orders", href: "/orders", icon: "orders", match: "prefix", group: "Library" },
  saved: { id: "saved", label: "Saved", href: "/saved", icon: "save", match: "prefix", group: "Library" },
  bag: { id: "bag", label: "Bag", href: "/cart", icon: "bag", match: "prefix", badge: "cart", group: "Library" },
  collaborations: { id: "collaborations", label: "Pending collaborations", href: "/pending-collaborations", icon: "collab", match: "prefix", group: "Library" },
  insights: { id: "insights", label: "Insights", href: "/insights", icon: "chart", match: "prefix", group: "Creator" },
  seller: { id: "seller", label: "Seller Studio", href: "/seller/dashboard", icon: "seller", match: "prefix", group: "Creator" },
  settings: { id: "settings", label: "Settings", href: "/settings", icon: "settings", match: "prefix", group: "Support" },
  help: { id: "help", label: "Help", href: "/help", icon: "help", match: "prefix", group: "Support" },
} as const satisfies Record<string, NavDestination>;

type DestinationId = keyof typeof DESTINATIONS;

function resolve(id: DestinationId, ctx: NavContext): NavDestination {
  const base = DESTINATIONS[id] as NavDestination;
  if (id === "studio") {
    return { ...base, href: ctx.username ? `/studio/${ctx.username}` : "/settings/profile" };
  }
  return base;
}

function allowed(dest: NavDestination, ctx: NavContext) {
  if (ctx.signedIn) return true;
  if (dest.id === "studio") return false;
  return !isProtectedPath(dest.href);
}

function pick(ids: DestinationId[], ctx: NavContext) {
  return ids.map((id) => resolve(id, ctx)).filter((dest) => allowed(dest, ctx));
}

/** Desktop rail, top to bottom. Guests see every public destination. */
export function railDestinations(ctx: NavContext) {
  return pick(["home", "explore", "communities", "shop", "takes", "messages", "studio", "orders"], ctx);
}

/** Phone bottom bar. Create and More are rendered by the bar itself. */
export function bottomBarDestinations(ctx: NavContext) {
  return pick(["home", "explore", "takes"], ctx);
}

/** Desktop More menu: the personal tools that are not in the rail. */
export function moreMenuDestinations(ctx: NavContext) {
  return pick(["saved", "bag", "collaborations", "insights", "seller", "settings", "help"], ctx);
}

/** Phone More sheet: everything not in the bottom bar. */
export function moreSheetDestinations(ctx: NavContext) {
  return pick(["communities", "shop", "messages", "studio", "saved", "bag", "orders", "collaborations", "insights", "seller", "settings", "help"], ctx);
}

/** Existing creation choices. Labels are clearer; stored types are untouched. */
export const CREATE_CHOICES: Array<{ label: string; description: string; href: string; icon: NavIconName }> = [
  { label: "Post", description: "Words, photos, video or sound", href: "/create", icon: "quill" },
  { label: "Product", description: "Something ready to buy", href: "/sell", icon: "product" },
  { label: "Service", description: "Work you make on request", href: "/sell/service", icon: "service" },
];

export function isDestinationActive(dest: NavDestination, pathname: string) {
  if (dest.match === "exact") return pathname === dest.href;
  if (dest.id === "studio") return pathname.startsWith("/studio/") && pathname.startsWith(dest.href);
  if (dest.id === "settings") return pathname.startsWith("/settings");
  return pathname === dest.href || pathname.startsWith(`${dest.href}/`);
}

export function formatCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function countLabel(label: string, count: number) {
  return count > 0 ? `${label}, ${count} unread` : label;
}
