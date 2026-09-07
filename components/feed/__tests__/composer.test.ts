import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import { tokenAtCaret } from "../CommentComposer";
import { describeReactors } from "../ReactionSummary";

describe("tokenAtCaret", () => {
  it("finds an @ token at the caret", () => {
    expect(tokenAtCaret("hey @po", 7)).toEqual({ trigger: "@", query: "po", start: 4, end: 7 });
  });
  it("finds a # token and an empty query right after the trigger", () => {
    expect(tokenAtCaret("#", 1)).toEqual({ trigger: "#", query: "", start: 0, end: 1 });
    expect(tokenAtCaret("look #art", 9)?.query).toBe("art");
  });
  it("ignores emails and tokens the caret has left", () => {
    expect(tokenAtCaret("mail me@x.com", 13)).toBeNull();
    expect(tokenAtCaret("@poet said", 10)).toBeNull();
  });
});

describe("describeReactors", () => {
  it("names the viewer, the top reactor and the rest", () => {
    expect(describeReactors(1, true, null)).toBe("You reacted");
    expect(describeReactors(1, false, "poet")).toBe("poet reacted");
    expect(describeReactors(2, true, "poet")).toBe("You and poet reacted");
    expect(describeReactors(5, true, "poet")).toBe("You, poet and 3 others reacted");
    expect(describeReactors(13, false, "poet")).toBe("poet and 12 others reacted");
  });
  it("falls back to a count while the summary is unknown", () => {
    expect(describeReactors(4, false, null)).toBe("4 reactions");
    expect(describeReactors(1, false, null)).toBe("1 reaction");
  });
});
