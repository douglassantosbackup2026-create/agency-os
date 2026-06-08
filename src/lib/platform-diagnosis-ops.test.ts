import { describe, expect, it } from "vitest";
import {
  canRetryDiagnosis,
  categorizeFailureClient,
  diagnosisStatusLabel,
  exportDiagnosisCsv,
} from "./platform-diagnosis-ops";
import type { DiagnosisRecentRow } from "./platform-diagnosis-ops";

const baseRow: DiagnosisRecentRow = {
  id: "00000000-0000-4000-8000-000000000001",
  secret_slug: "test-slug-12345678",
  status: "failed",
  management_status: "none",
  created_at: "2026-01-01T00:00:00Z",
  completed_at: null,
  updated_at: "2026-01-01T00:00:00Z",
  payment_method: "pix",
  amount_cents: 3700,
  management_amount_cents: 0,
  payer_email_masked: "d***@example.com",
  prompt_version: "v16",
  failed_reason_short: "Todos os providers IA falharam",
  meta_connected: true,
  cta_clicked: false,
  funnel_age_minutes: 12,
};

describe("categorizeFailureClient", () => {
  it("classifies meta token failures", () => {
    expect(categorizeFailureClient("Token Meta expirado")).toBe("meta_token");
  });

  it("classifies AI failures", () => {
    expect(categorizeFailureClient("Orçamento diário de IA")).toBe(
      "ai_providers",
    );
  });

  it("defaults to other", () => {
    expect(categorizeFailureClient("erro desconhecido")).toBe("other");
  });
});

describe("canRetryDiagnosis", () => {
  it("blocks non-failed", () => {
    expect(canRetryDiagnosis({ ...baseRow, status: "completed" })).toBe(false);
  });

  it("blocks meta token without retry", () => {
    expect(
      canRetryDiagnosis({
        ...baseRow,
        failed_reason_short: "Reconecta token Meta",
      }),
    ).toBe(false);
  });

  it("allows retry when failed with meta connected", () => {
    expect(
      canRetryDiagnosis({
        ...baseRow,
        failed_reason_short: "timeout genérico",
      }),
    ).toBe(true);
  });
});

describe("diagnosisStatusLabel", () => {
  it("returns PT label", () => {
    expect(diagnosisStatusLabel("awaiting_payment")).toBe(
      "Aguardando pagamento",
    );
  });
});

describe("exportDiagnosisCsv", () => {
  it("includes header and row", () => {
    const csv = exportDiagnosisCsv([baseRow]);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("failed");
    expect(csv).toContain(baseRow.id);
  });
});
