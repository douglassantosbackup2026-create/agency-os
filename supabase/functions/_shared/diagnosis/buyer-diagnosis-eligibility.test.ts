import { describe, expect, it } from "vitest";
import {
  buildExistingPaidDiagnosisPayload,
  isDiagnosisFulfilled,
  normalizePayerEmail,
  pickOpenPaidDiagnosis,
  type DiagnosisEligibilityRow,
} from "./buyer-diagnosis-eligibility.ts";

function row(
  partial: Partial<DiagnosisEligibilityRow> & Pick<DiagnosisEligibilityRow, "id" | "status">,
): DiagnosisEligibilityRow {
  return {
    secret_slug: "abc123",
    mp_payment_id: "mp-1",
    payer_email: "buyer@example.com",
    ...partial,
  };
}

describe("buyer-diagnosis-eligibility", () => {
  it("normaliza e-mail", () => {
    expect(normalizePayerEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });

  it("fulfilled só com completed e analysis_json", () => {
    expect(isDiagnosisFulfilled({ status: "completed" }, { analysis_json: {} })).toBe(
      true,
    );
    expect(isDiagnosisFulfilled({ status: "completed" }, { analysis_json: null })).toBe(
      false,
    );
    expect(isDiagnosisFulfilled({ status: "failed" }, { analysis_json: {} })).toBe(
      false,
    );
  });

  it("pickOpenPaidDiagnosis ignora fulfilled e retorna failed pago", () => {
    const fulfilledId = "11111111-1111-4111-8111-111111111111";
    const failedId = "22222222-2222-4222-8222-222222222222";
    const rows = [
      row({ id: fulfilledId, status: "completed", mp_payment_id: "mp-old" }),
      row({ id: failedId, status: "failed", mp_payment_id: "mp-new" }),
    ];
    const reports = new Map([
      [fulfilledId, { analysis_json: { score: 70 } }],
      [failedId, { analysis_json: null }],
    ]);
    const open = pickOpenPaidDiagnosis(rows, reports);
    expect(open?.id).toBe(failedId);
    expect(open?.status).toBe("failed");
  });

  it("pickOpenPaidDiagnosis retorna awaiting_connection", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const rows = [row({ id, status: "awaiting_connection" })];
    const open = pickOpenPaidDiagnosis(rows, new Map([[id, { analysis_json: null }]]));
    expect(open?.status).toBe("awaiting_connection");
  });

  it("pickOpenPaidDiagnosis retorna null quando todos fulfilled", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const rows = [row({ id, status: "completed" })];
    const open = pickOpenPaidDiagnosis(
      rows,
      new Map([[id, { analysis_json: { ok: true } }]]),
    );
    expect(open).toBeNull();
  });

  it("buildExistingPaidDiagnosisPayload inclui resume_path", () => {
    const id = "55555555-5555-4555-8555-555555555555";
    const payload = buildExistingPaidDiagnosisPayload({
      id,
      secret_slug: "secret99",
      status: "processing",
    });
    expect(payload.code).toBe("existing_paid_diagnosis");
    expect(payload.diagnosis_id).toBe(id);
    expect(payload.resume_path).toBe(`/obrigado?d=${id}&s=secret99`);
  });
});
