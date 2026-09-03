// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countdown, longDate, relativeDays, shortDate, shortDateTime } from "@/lib/utils/time";

describe("order date helpers (the one date util)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-03T12:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("shortDate shows the year only when it differs", () => {
    expect(shortDate("2026-09-12T10:00:00Z")).toMatch(/^Sep 12$/);
    expect(shortDate("2025-09-12T10:00:00Z")).toMatch(/^Sep 12, 2025$/);
    expect(shortDate(null)).toBe("");
  });

  it("shortDateTime and longDate format", () => {
    expect(shortDateTime("2026-09-12T10:52:00Z")).toMatch(/^Sep 12, \d{1,2}:52 [AP]M$/);
    expect(longDate("2026-09-12T10:52:00Z")).toBe("September 12, 2026");
    expect(longDate(undefined)).toBe("");
  });

  it("relativeDays reads like a person", () => {
    expect(relativeDays("2026-09-03T18:00:00Z")).toEqual({ text: "today", late: false });
    expect(relativeDays("2026-09-04T12:00:00Z")).toEqual({ text: "tomorrow", late: false });
    expect(relativeDays("2026-09-12T12:00:00Z")).toEqual({ text: "in 9 days", late: false });
    expect(relativeDays("2026-09-01T12:00:00Z")).toEqual({ text: "2 days late", late: true });
    expect(relativeDays("2026-09-02T12:00:00Z", "overdue")).toEqual({ text: "1 day overdue", late: true });
  });

  it("countdown collapses to days past 24 hours and blanks when passed", () => {
    expect(countdown("2026-09-06T11:00:00Z")).toBe("2d 23h");
    expect(countdown("2026-09-03T16:12:00Z")).toBe("4h 12m");
    expect(countdown("2026-09-01T00:00:00Z")).toBe("");
  });
});
