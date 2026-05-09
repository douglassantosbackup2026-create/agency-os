import { describe, expect, it } from "vitest";
import {
  canCreateClient,
  defaultLimits,
  isWithinAlertBudget,
  mergeSubscription,
} from "./subscription-limits";

describe("subscription-limits", () => {
  it("defaultLimits", () => {
    expect(defaultLimits().max_clients).toBe(5);
    expect(defaultLimits().max_alerts).toBe(100);
  });

  it("mergeSubscription fills gaps", () => {
    expect(mergeSubscription({ max_clients: 12 }).max_clients).toBe(12);
    expect(mergeSubscription({ max_clients: 12 }).max_alerts).toBe(100);
    expect(mergeSubscription(null).plan).toBe("free");
  });

  it("canCreateClient respects merged max_clients", () => {
    expect(canCreateClient(4, null)).toBe(true);
    expect(canCreateClient(5, null)).toBe(false);
    expect(canCreateClient(9, mergeSubscription({ max_clients: 10 }))).toBe(
      true,
    );
  });

  it("isWithinAlertBudget uses inclusive ceiling", () => {
    expect(isWithinAlertBudget(100, null)).toBe(true);
    expect(isWithinAlertBudget(101, null)).toBe(false);
    expect(isWithinAlertBudget(50, mergeSubscription({ max_alerts: 50 }))).toBe(
      true,
    );
  });
});
