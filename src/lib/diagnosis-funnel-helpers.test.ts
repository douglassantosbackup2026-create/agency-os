import { describe, expect, it } from "vitest";
import {
  diagnosisPollTerminal,
  diagnosisStatusAllowsOAuth,
  managementReferenceId,
  managementReferenceIsDiagnosis,
  obrigadoParamsValid,
  parseObrigadoParams,
} from "./diagnosis-funnel-helpers";

describe("diagnosis-funnel-helpers", () => {
  it("parseObrigadoParams", () => {
    const p = new URLSearchParams("d=abc&s=secret&t=tok");
    expect(parseObrigadoParams(p)).toEqual({
      diagnosisId: "abc",
      secretSlug: "secret",
      autoLoginToken: "tok",
    });
  });

  it("obrigadoParamsValid", () => {
    expect(
      obrigadoParamsValid("550e8400-e29b-41d4-a716-446655440000", "abc"),
    ).toBe(true);
    expect(obrigadoParamsValid("", "x")).toBe(false);
  });

  it("diagnosisPollTerminal", () => {
    expect(diagnosisPollTerminal("completed")).toBe("ready");
    expect(diagnosisPollTerminal("processing")).toBe("pending");
  });

  it("management external_reference", () => {
    expect(managementReferenceIsDiagnosis("uuid-here")).toBe(true);
    expect(managementReferenceIsDiagnosis("mgmt:uuid")).toBe(false);
    expect(managementReferenceId("mgmt:abc-123")).toBe("abc-123");
  });

  it("diagnosisStatusAllowsOAuth", () => {
    expect(diagnosisStatusAllowsOAuth("awaiting_connection")).toBe(true);
    expect(diagnosisStatusAllowsOAuth("processing")).toBe(false);
  });
});
