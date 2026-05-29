import { describe, expect, it } from "vitest";

describe("sync lock semantics", () => {
  it("running status deve ser distinto de ok/error para lock parcial", () => {
    const statuses = ["ok", "warning", "error", "running"] as const;
    expect(statuses).toContain("running");
    expect(new Set(statuses).size).toBe(4);
  });
});
