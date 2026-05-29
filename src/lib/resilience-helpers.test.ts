import { describe, expect, it } from "vitest";
import {
  aiBudgetWouldExceed,
  diagnosisBudgetWouldExceed,
  isWebhookDuplicateError,
} from "./resilience-helpers";

describe("resilience-helpers", () => {
  it("detecta conflito de idempotência Postgres", () => {
    expect(isWebhookDuplicateError("23505")).toBe(true);
    expect(isWebhookDuplicateError("42P01")).toBe(false);
  });

  it("check_ai_budget: tokens usados + estimativa excedem teto", () => {
    expect(aiBudgetWouldExceed(490_000, 12_000, 500_000)).toBe(true);
    expect(aiBudgetWouldExceed(100_000, 12_000, 500_000)).toBe(false);
    expect(aiBudgetWouldExceed(488_000, 12_000, 500_000)).toBe(false);
  });

  it("check_diagnosis_ai_budget: teto global 100k", () => {
    expect(diagnosisBudgetWouldExceed(95_000, 10_000)).toBe(true);
    expect(diagnosisBudgetWouldExceed(80_000, 10_000)).toBe(false);
  });
});
