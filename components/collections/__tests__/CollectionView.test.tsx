import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CollectionView from "../CollectionView";

const mocks = vi.hoisted(() => ({ open: vi.fn(), owner: true }));
const root = { id: "root", user_id: "owner", name: "Favorites", slug: "favorites", works_count: 1 };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => ({ user: mocks.owner ? { id: "owner" } : null }) }));
vi.mock("@/components/providers/ModalProvider", () => ({ useModal: () => ({ openCollectionModal: mocks.open, openPostModal: vi.fn(), subscribeToDeletes: () => vi.fn(), subscribeToAuthorBlocks: () => vi.fn() }) }));
vi.mock("@/lib/hooks/useProfile", () => ({ useProfile: () => ({ profile: { id: "owner", display_name: "Hadi" }, loading: false }) }));
vi.mock("@/lib/hooks/useCollections", () => ({
  useCollections: () => ({ collections: [root, { id: "movies", parent_id: "root", name: "Movies", slug: "movies-1", works_count: 1 }], refetch: vi.fn() }),
  useCollectionBySlug: () => ({ collection: root, loading: false, refetch: vi.fn() }),
  useCollectionWorks: () => ({ posts: [], setPosts: vi.fn(), loading: false, refetch: vi.fn() }),
  useCollectionMutations: () => ({ busy: false }),
}));
vi.mock("../NewCollectionModal", () => ({ default: ({ isOpen, parentId }: { isOpen: boolean; parentId?: string }) => isOpen ? <div data-testid="editor">{parentId ? `Inside ${parentId}` : "Edit collection"}</div> : null }));
vi.mock("../AddWorksSheet", () => ({ default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="add-works">Choose works</div> : null }));

describe("Collection hierarchy and owner menu", () => {
  it("opens the child collection from the parent modal", () => {
    render(<CollectionView username="hadi" slug="favorites" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Movies/ }));
    expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ slug: "movies-1", username: "hadi" }));
  });
  it("keeps owner actions in the header menu and adds a child to this parent", async () => {
    render(<CollectionView username="hadi" slug="favorites" onClose={vi.fn()} />);
    expect(screen.queryByRole("menuitem", { name: "Add works" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Collection options" }));
    expect(await screen.findByRole("menuitem", { name: "Add works" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Arrange works" })).toBeDisabled();
    fireEvent.click(screen.getByRole("menuitem", { name: "New subcollection" }));
    expect(screen.getByTestId("editor")).toHaveTextContent("Inside root");
  });
  it("hides management from visitors while keeping subcollections accessible", () => {
    mocks.owner = false;
    render(<CollectionView username="hadi" slug="favorites" />);
    expect(screen.queryByRole("button", { name: "Collection options" })).toBeNull();
    expect(screen.getByRole("button", { name: /Movies/ })).toBeVisible();
    mocks.owner = true;
  });
});
