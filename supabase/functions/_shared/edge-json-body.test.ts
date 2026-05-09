import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readJsonBody } from "./edge-json-body";

describe("edge-json-body", () => {
  it("parse objeto JSON válido", async () => {
    const req = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });
    const j = await readJsonBody(req, 4096);
    expect(j.a).toBe(1);
  });

  it("rejeita quando Content-Length > limite", async () => {
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-length": "99999999" },
      body: "{}",
    });
    await expect(readJsonBody(req, 100)).rejects.toThrow(BodyTooLargeError);
  });

  it("rejeita quando corpo excede limite", async () => {
    const big = "x".repeat(500);
    const req = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ k: big }),
    });
    await expect(readJsonBody(req, 200)).rejects.toThrow(BodyTooLargeError);
  });
});
