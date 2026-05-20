import { describe, expect, it } from "vitest";
import { formatMetaError, isAllowedTestRedirectUri } from "./meta-graph-api.ts";

describe("meta-graph-api", () => {
  it("formatMetaError builds readable message", () => {
    const msg = formatMetaError(
      {
        error: {
          message: "Invalid OAuth access token.",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "abc123",
        },
      },
      400,
    );
    expect(msg).toContain("Invalid OAuth access token");
    expect(msg).toContain("code=190");
    expect(msg).toContain("subcode=463");
  });

  it("isAllowedTestRedirectUri accepts localhost only", () => {
    expect(
      isAllowedTestRedirectUri(
        "http://localhost:5173/test-meta-oauth/callback",
      ),
    ).toBe(true);
    expect(
      isAllowedTestRedirectUri(
        "http://127.0.0.1:5173/test-meta-oauth/callback",
      ),
    ).toBe(true);
    expect(
      isAllowedTestRedirectUri(
        "https://app.example.com/test-meta-oauth/callback",
      ),
    ).toBe(false);
  });
});
