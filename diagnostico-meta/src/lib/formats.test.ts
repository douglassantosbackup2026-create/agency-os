import { describe, it, expect } from "vitest";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^[0-9a-f]{32}$/i;

describe("diagnosis id formats", () => {
  it("accepts uuid v4", () => {
    expect(uuid.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
  it("accepts 32 hex secret slug", () => {
    expect(slug.test("a".repeat(32))).toBe(true);
  });
});
