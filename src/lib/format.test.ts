import { describe, expect, it, vi, afterEach } from "vitest";
import { brl, initials, pct, timeAgo } from "./format";

describe("format", () => {
  it("brl formats currency", () => {
    expect(brl(1234)).toMatch(/234/);
  });

  it("pct formats percent", () => {
    expect(pct(12.3)).toBe("12.3%");
  });

  it("initials from name", () => {
    expect(initials("Maria Silva")).toBe("MS");
    expect(initials(null)).toBe("??");
  });
});

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows seconds for very recent timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:30Z"));
    expect(timeAgo(new Date("2026-05-08T12:00:00Z").toISOString())).toMatch(
      /há \d+s/,
    );
  });

  it("shows minutes within the hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:45:00Z"));
    expect(timeAgo(new Date("2026-05-08T12:30:00Z").toISOString())).toMatch(
      /há \d+min/,
    );
  });
});
