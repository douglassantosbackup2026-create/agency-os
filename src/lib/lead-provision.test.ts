import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

describe("provision-lead-client contract", () => {
  it("creates client from paid lead with checklist and tags", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/provision-lead-client/index.ts"),
      "utf8",
    );
    expect(src).toMatch(/ecommerce_lead_id/);
    expect(src).toMatch(/status !== "paid"/);
    expect(src).toMatch(/onboarding_checklist_items/);
    expect(src).toMatch(/origem:gestao-trafego/);
    expect(src).toMatch(/lead_provision/);
  });
});

describe("lead-paid-hook contract", () => {
  it("notifies ops idempotently", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/_shared/lead-paid-hook.ts"),
      "utf8",
    );
    expect(src).toMatch(/ops_notified_at/);
    expect(src).toMatch(/ecommerce_lead_paid/);
    expect(src).toMatch(/lead_paid_onboarding/);
    expect(src).toMatch(/action_center/);
  });
});

describe("lead transparent checkout contract", () => {
  it("start-lead-payment validates slug and returns mp key", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/start-lead-payment/index.ts"),
      "utf8",
    );
    expect(src).toMatch(/assertLeadCheckoutReady/);
    expect(src).toMatch(/MERCADOPAGO_PUBLIC_KEY/);
    expect(src).toMatch(/lead-start:/);
  });

  it("process-lead-payment supports pix and preapproval card", () => {
    const src = readFileSync(
      resolve(root, "supabase/functions/process-lead-payment/index.ts"),
      "utf8",
    );
    expect(src).toMatch(/lead:\$\{leadId\}/);
    expect(src).toMatch(/lead-sub:\$\{leadId\}/);
    expect(src).toMatch(/ecommerce_lead_id/);
    expect(src).toMatch(/notifyLeadPaid/);
  });

  it("migration adds transparent checkout columns", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260702180000_lead_transparent_checkout.sql"),
      "utf8",
    );
    expect(sql).toMatch(/payer_cpf/);
    expect(sql).toMatch(/pix_qr_code/);
    expect(sql).toMatch(/ecommerce_lead_id/);
  });
});
