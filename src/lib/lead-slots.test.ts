import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeAvailableSlots,
  computeWaitlistDisplay,
  formatLeadSlotsBadge,
  formatLeadWaitlistUrgency,
  leadSlotsWhatsAppLine,
} from "@/content/gestao-lead-slots";

const root = resolve(import.meta.dirname, "../..");

describe("gestao-lead-slots helpers", () => {
  it("computes available slots from cap and used", () => {
    expect(computeAvailableSlots(3, 0)).toBe(3);
    expect(computeAvailableSlots(3, 1)).toBe(2);
    expect(computeAvailableSlots(3, 3)).toBe(0);
    expect(computeAvailableSlots(3, 5)).toBe(0);
  });

  it("formats badge copy for singular and plural", () => {
    expect(formatLeadSlotsBadge(3)).toBe("Apenas 3 vagas este mês");
    expect(formatLeadSlotsBadge(1)).toBe("Apenas 1 vaga disponível neste mês");
    expect(formatLeadSlotsBadge(0)).toBe("Vagas esgotadas este mês");
  });

  it("formats WhatsApp line with dynamic availability", () => {
    expect(leadSlotsWhatsAppLine(2, "R$ 4.997")).toContain("2 vagas");
    expect(leadSlotsWhatsAppLine(0, "R$ 4.997")).toContain("lista de espera");
  });

  it("computes waitlist display from base and pending leads", () => {
    expect(computeWaitlistDisplay(28, 0)).toBe(28);
    expect(computeWaitlistDisplay(28, 3)).toBe(31);
  });

  it("formats waitlist urgency copy in first person", () => {
    const copy = formatLeadWaitlistUrgency(31, 2);
    expect(copy.headline).toContain("31 e-commerces");
    expect(copy.headline).toContain("apenas 2 vagas");
    expect(copy.subline).toContain("Quem garantir agora entra");
  });
});

describe("lead monthly slots contract", () => {
  it("shared module exposes snapshot and atomic mark", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/_shared/lead-slots-shared.ts"),
      "utf8",
    );
    expect(src).toMatch(/getLeadSlotSnapshot/);
    expect(src).toMatch(/markLeadPaidIfSlotAvailable/);
    expect(src).toMatch(/countLeadWaitlistThisMonth/);
    expect(src).toMatch(/waitlist_display/);
    expect(src).toMatch(/try_mark_ecommerce_lead_paid/);
    expect(src).toMatch(/LEAD_SLOTS_FULL_MESSAGE/);
  });

  it("lead-available-slots edge function is public GET", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/lead-available-slots/index.ts"),
      "utf8",
    );
    expect(src).toMatch(/getLeadSlotSnapshot/);
    expect(src).toMatch(/GET/);
  });

  it("payment handlers enforce slot claim", () => {
    const processSrc = readFileSync(
      resolve(root, "supabase/functions/process-lead-payment/index.ts"),
      "utf8",
    );
    expect(processSrc).toMatch(/markLeadPaidIfSlotAvailable/);
    expect(processSrc).toMatch(/lead_slots_full/);

    const statusSrc = readFileSync(
      resolve(root, "supabase/functions/lead-payment-status/index.ts"),
      "utf8",
    );
    expect(statusSrc).toMatch(/markLeadPaidIfSlotAvailable/);
    expect(statusSrc).toMatch(/slots/);

    const webhookSrc = readFileSync(
      resolve(root, "supabase/functions/mercadopago-webhook/index.ts"),
      "utf8",
    );
    expect(webhookSrc).toMatch(/markLeadPaidIfSlotAvailable/);
  });

  it("migration defines slot RPCs", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260702190000_lead_monthly_slots.sql"),
      "utf8",
    );
    expect(sql).toMatch(/get_ecommerce_lead_slot_snapshot/);
    expect(sql).toMatch(/try_mark_ecommerce_lead_paid/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
  });
});
