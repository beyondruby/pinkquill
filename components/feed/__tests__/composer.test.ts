import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import { tokenAtCaret } from "../CommentComposer";
import { describeReactionTotal } from "../ReactionBarFooter";

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

describe("describeReactionTotal", () => {
  it("invites the first reaction and names the viewer when alone", () => {
    expect(describeReactionTotal(0, false)).toBe("Be the first to react");
    expect(describeReactionTotal(1, true)).toBe("Only you so far");
  });
  it("counts everyone otherwise", () => {
    expect(describeReactionTotal(1, false)).toBe("See all 1 reaction");
    expect(describeReactionTotal(13, true)).toBe("See all 13 reactions");
    expect(describeReactionTotal(1200, false)).toBe("See all 1,200 reactions");
  });
});
