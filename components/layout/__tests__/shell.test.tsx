import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const auth = { user: null as null | { id: string }, profile: null as null | { username: string; display_name: string | null; avatar_url: string | null }, loading: false, signOut: vi.fn() };
const counts = { unreadNotifications: 0, unreadMessages: 0, cartCount: 0 };
let pathname = "/";

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@/components/providers/BadgeCountProvider", () => ({ useBadgeCounts: () => counts }));
vi.mock("@/components/theme/QuickThemeToggle", () => ({ QuickThemeToggle: () => <div>Appearance</div> }));
vi.mock("@/components/search/SearchBar", () => ({ default: () => <input aria-label="Search people, work, communities" /> }));
vi.mock("@/components/notifications/NotificationPanel", () => ({ default: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Notifications"><button onClick={onClose}>Close</button></div> }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    // Resolve the real module synchronously for tests: MobileMoreSheet and NotificationPanel mocks.
    let Comp: React.ComponentType<Record<string, unknown>> | null = null;
    void loader().then((m) => { Comp = m.default; });
    return function Dynamic(props: Record<string, unknown>) {
      const [, force] = React.useState(0);
      React.useEffect(() => { if (!Comp) loader().then(() => force((n) => n + 1)); }, []);
      return Comp ? <Comp {...props} /> : null;
    };
  },
}));

import React from "react";
import DesktopRail from "../DesktopRail";
import TopBar from "../TopBar";
import MobileBottomNav from "../MobileBottomNav";
import { railDestinations, moreSheetDestinations, isDestinationActive, DESTINATIONS } from "../navigation";

beforeEach(() => {
  auth.user = null;
  auth.profile = null;
  auth.loading = false;
  counts.unreadMessages = 0;
  counts.unreadNotifications = 0;
  counts.cartCount = 0;
  pathname = "/";
});

describe("navigation registry", () => {
  it("gives guests every public destination and hides protected ones", () => {
    const guest = railDestinations({ signedIn: false }).map((d) => d.id);
    expect(guest).toEqual(["home", "explore", "communities", "shop", "takes"]);
    const more = moreSheetDestinations({ signedIn: false }).map((d) => d.id);
    expect(more).toEqual(["communities", "shop", "help"]);
  });

  it("points My studio at the person's public studio and marks it active there", () => {
    const [studio] = railDestinations({ signedIn: true, username: "noor" }).filter((d) => d.id === "studio");
    expect(studio.href).toBe("/studio/noor");
    expect(isDestinationActive(studio, "/studio/noor")).toBe(true);
    expect(isDestinationActive(studio, "/studio/lina")).toBe(false);
    expect(isDestinationActive(DESTINATIONS.home, "/explore")).toBe(false);
    expect(isDestinationActive(DESTINATIONS.communities, "/community/the-making-room")).toBe(true);
  });
});

describe("DesktopRail", () => {
  it("shows guests the public destinations and a sign-in action, without Create", () => {
    render(<DesktopRail />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("href", "/community");
    expect(screen.queryByRole("link", { name: /Messages/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?redirect=%2F");
  });

  it("labels unread messages, links the account to the studio, and offers Create and More when signed in", async () => {
    auth.user = { id: "u1" };
    auth.profile = { username: "noor", display_name: "Noor Ahmed", avatar_url: null };
    counts.unreadMessages = 2;
    pathname = "/community/the-making-room";
    render(<DesktopRail />);
    expect(screen.getByRole("link", { name: "Messages, 2 unread" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Noor Ahmed, open my studio" })).toHaveAttribute("href", "/studio/noor");

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: /Post/ })).toBeInTheDocument());
    expect(screen.getByRole("menuitem", { name: /Service/ })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Saved" })).toHaveAttribute("href", "/saved"));
    expect(screen.getByRole("menuitem", { name: "Seller Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

describe("TopBar", () => {
  it("keeps search visible for guests and offers sign-in", () => {
    render(<TopBar />);
    expect(screen.getByLabelText("Search people, work, communities")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Notifications/ })).toBeNull();
  });

  it("announces unread notifications and opens the panel", async () => {
    auth.user = { id: "u1" };
    auth.profile = { username: "noor", display_name: "Noor Ahmed", avatar_url: null };
    counts.unreadNotifications = 3;
    render(<TopBar />);
    const bell = screen.getByRole("button", { name: "Notifications, 3 unread" });
    fireEvent.click(bell);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: "My studio" })).toHaveAttribute("href", "/studio/noor");
  });
});

describe("MobileBottomNav", () => {
  it("gives guests Home, Explore, Takes, Sign in and More", () => {
    pathname = "/takes";
    render(<MobileBottomNav />);
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Takes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("opens the three creation choices and the More sheet for signed-in people", async () => {
    auth.user = { id: "u1" };
    auth.profile = { username: "noor", display_name: "Noor Ahmed", avatar_url: null };
    counts.cartCount = 2;
    render(<MobileBottomNav />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    const createSheet = await screen.findByRole("dialog", { name: "Create" });
    expect(createSheet).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Product/ })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const more = await screen.findByRole("dialog", { name: "More" });
    expect(more).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Noor Ahmed, open my studio" })).toHaveAttribute("href", "/studio/noor");
    expect(screen.getByRole("link", { name: "Bag" })).toHaveAttribute("href", "/cart");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
