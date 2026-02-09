import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostDraft, useAutoSave, useDrafts } from "../useDrafts";

function createDraftPayload(
  overrides: Partial<Omit<PostDraft, "id" | "createdAt" | "updatedAt">> = {}
): Omit<PostDraft, "id" | "createdAt" | "updatedAt"> {
  return {
    type: "thought",
    title: "Draft title",
    content: "<p>Draft content</p>",
    visibility: "public",
    contentWarning: "",
    collaborators: [],
    mentions: [],
    communityId: null,
    communityName: undefined,
    mediaMetadata: [],
    styling: undefined,
    ...overrides,
  };
}

describe("useDrafts", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    };

    vi.stubGlobal("localStorage", mockStorage);
    vi.clearAllMocks();
  });

  it("stores drafts per user scope", async () => {
    const userAScope = renderHook(() => useDrafts("user-a"));
    const userBScope = renderHook(() => useDrafts("user-b"));

    await waitFor(() => {
      expect(userAScope.result.current.loading).toBe(false);
      expect(userBScope.result.current.loading).toBe(false);
    });

    act(() => {
      userAScope.result.current.saveDraft(createDraftPayload({ title: "User A draft" }));
    });

    expect(userAScope.result.current.getMostRecentDraft()?.title).toBe("User A draft");
    expect(userBScope.result.current.getMostRecentDraft()).toBeNull();
  });

  it("migrates legacy drafts to scoped storage and clears legacy key", async () => {
    const legacyDraft: PostDraft = {
      id: "legacy-1",
      type: "thought",
      title: "Legacy draft",
      content: "<p>legacy</p>",
      visibility: "public",
      contentWarning: "",
      collaborators: [],
      mentions: [],
      communityId: null,
      mediaMetadata: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
    };

    localStorage.setItem("pinkquill_drafts", JSON.stringify([legacyDraft]));

    const scoped = renderHook(() => useDrafts("user-a"));

    await waitFor(() => {
      expect(scoped.result.current.loading).toBe(false);
    });

    expect(scoped.result.current.getMostRecentDraft()?.title).toBe("Legacy draft");
    expect(localStorage.getItem("pinkquill_drafts:user-a")).toBeTruthy();
    expect(localStorage.getItem("pinkquill_drafts")).toBeNull();
  });
});

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses injected saveDraft callback when triggerSave is called", () => {
    const saveDraft = vi.fn().mockReturnValue("draft-id-1");
    const getDraftData = vi.fn(() =>
      createDraftPayload({
        title: "Autosave draft",
        content: "<p>Autosaved content</p>",
      })
    );

    const { result } = renderHook(() =>
      useAutoSave(getDraftData, {
        enabled: false,
        saveDraft,
      })
    );

    act(() => {
      result.current.triggerSave();
    });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(result.current.draftId).toBe("draft-id-1");
    expect(result.current.lastSaved).toBeInstanceOf(Date);
  });
});
