import { describe, expect, it } from "vitest";
import { brl, initials, pct } from "./format";

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
