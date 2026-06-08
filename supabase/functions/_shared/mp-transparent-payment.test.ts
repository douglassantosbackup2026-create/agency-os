import { describe, expect, it } from "vitest";
import { validateCpf, validatePayerInput } from "./mp-transparent-payment.ts";

describe("mp-transparent-payment", () => {
  it("valida CPF válido", () => {
    expect(validateCpf("52998224725")).toBe(true);
  });

  it("rejeita CPF inválido", () => {
    expect(validateCpf("11111111111")).toBe(false);
  });

  it("validatePayerInput aceita payer completo", () => {
    const r = validatePayerInput({
      name: "Maria Silva",
      email: "maria@loja.com",
      cpf: "529.982.247-25",
      phone: "(11) 99999-9999",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payer.cpf).toBe("52998224725");
    }
  });

  it("validatePayerInput rejeita email inválido", () => {
    const r = validatePayerInput({
      name: "Maria",
      email: "bad",
      cpf: "52998224725",
      phone: "11999999999",
    });
    expect(r.ok).toBe(false);
  });
});
