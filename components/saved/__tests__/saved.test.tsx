import { describe, expect, it } from "vitest";
import { SAVED_KINDS, emptyCopy, keptWord } from "../words";

describe("saved words", () => {
  it("counts what is kept in plain words", () => {
    expect(keptWord(0)).toBe("Things you keep for later live here.");
    expect(keptWord(1)).toBe("1 thing you kept for later.");
    expect(keptWord(12)).toBe("12 things you kept for later.");
  });

  it("points each empty kind back to its source", () => {
    expect(SAVED_KINDS.map((k) => k.id)).toEqual(["all", "posts", "takes", "products"]);
    expect(emptyCopy("takes").href).toBe("/takes");
    expect(emptyCopy("products").href).toBe("/shop");
    expect(emptyCopy("posts").href).toBe("/");
    expect(emptyCopy("all").title).toBe("Nothing saved yet");
  });
});
