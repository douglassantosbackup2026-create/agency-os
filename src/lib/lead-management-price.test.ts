import { describe, expect, it } from "vitest";
import {
  budgetFromLeadRange,
  formatLeadManagementPrice,
  LEAD_MANAGEMENT_PRICE_CENTS,
  leadManagementPriceBrl,
} from "@/lib/lead-management-price";

describe("lead-management-price", () => {
  it("formats default price in BRL", () => {
    expect(formatLeadManagementPrice()).toMatch(/4\.997|4997/);
  });

  it("converts cents to BRL number", () => {
    expect(leadManagementPriceBrl(LEAD_MANAGEMENT_PRICE_CENTS)).toBe(4997);
  });

  it("maps budget ranges", () => {
    expect(budgetFromLeadRange("5k-15k")).toBe(10000);
    expect(budgetFromLeadRange(">50k")).toBe(75000);
  });
});
