import { describe, expect, it } from "vitest";
import {
  auditBulletsFromResult,
  auditOverallStatus,
} from "./audit-dashboard.ts";

describe("audit-dashboard", () => {
  it("auditBulletsFromResult extrai recomendações com revisão humana", () => {
    const bullets = auditBulletsFromResult(
      {
        recommendations: [
          {
            requires_human_review: true,
            suggested_copy: "Testar novo criativo",
          },
          {
            requires_human_review: false,
            suggested_copy: "Ignorar",
          },
        ],
      },
      null,
      3,
    );
    expect(bullets).toContain("Testar novo criativo");
    expect(bullets.length).toBe(1);
  });

  it("auditOverallStatus devolve string ou null", () => {
    expect(auditOverallStatus({ overall_status: " OK " })).toBe("OK");
    expect(auditOverallStatus({})).toBeNull();
  });
});
