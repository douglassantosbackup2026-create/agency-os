import { describe, expect, it } from "vitest";
import {
  GESTAO_PRODUCT,
  isDiagnosisPaidStatus,
  trackRoutePixelEvents,
} from "./meta-pixel";
import { leadManagementPriceBrl } from "./lead-management-price";

describe("isDiagnosisPaidStatus", () => {
  it("returns false for awaiting_payment", () => {
    expect(isDiagnosisPaidStatus("awaiting_payment")).toBe(false);
    expect(isDiagnosisPaidStatus(null)).toBe(false);
  });

  it("returns true after payment", () => {
    expect(isDiagnosisPaidStatus("awaiting_connection")).toBe(true);
    expect(isDiagnosisPaidStatus("processing")).toBe(true);
    expect(isDiagnosisPaidStatus("completed")).toBe(true);
  });
});

describe("trackRoutePixelEvents", () => {
  it("does not throw for known routes", () => {
    expect(() => trackRoutePixelEvents("/")).not.toThrow();
    expect(() => trackRoutePixelEvents("/checkout")).not.toThrow();
    expect(() => trackRoutePixelEvents("/gestao-checkout")).not.toThrow();
    expect(() => trackRoutePixelEvents("/gestao-trafego-checkout")).not.toThrow();
    expect(() => trackRoutePixelEvents("/diagnostico-meta")).not.toThrow();
    expect(() =>
      trackRoutePixelEvents("/diagnostico/abc/conectar"),
    ).not.toThrow();
    expect(() => trackRoutePixelEvents("/dashboard")).not.toThrow();
  });
});

describe("GESTAO_PRODUCT", () => {
  it("uses lead funnel price in BRL for pixel value", () => {
    expect(GESTAO_PRODUCT.value).toBe(leadManagementPriceBrl());
  });
});
