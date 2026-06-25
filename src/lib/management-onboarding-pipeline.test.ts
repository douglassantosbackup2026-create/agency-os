import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mapUrgencyToPriority, parseActionPlan } from "./management-action-plan";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("management-action-plan", () => {
  it("maps urgency to action center priority", () => {
    expect(mapUrgencyToPriority("now")).toBe("alta");
    expect(mapUrgencyToPriority("soon")).toBe("media");
    expect(mapUrgencyToPriority("later")).toBe("baixa");
    expect(mapUrgencyToPriority(undefined)).toBe("baixa");
  });

  it("parses actionPlan from analysis json", () => {
    const steps = parseActionPlan({
      actionPlan: [
        { step: 1, action: "Isolar criativo vencedor", urgency: "now" },
        { action: "Testar hook", urgency: "soon" },
      ],
    });
    expect(steps).toHaveLength(2);
    expect(steps[0]?.action).toContain("criativo");
  });
});

describe("management onboarding pipeline migration", () => {
  it("defines schema, RPCs and RLS for onboarding submissions", () => {
    const sql = readFileSync(
      join(
        root,
        "supabase/migrations/20260625140000_management_onboarding_pipeline.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/clients\.diagnosis_id|diagnosis_id uuid/i);
    expect(sql).toMatch(/management_onboarding_submissions/i);
    expect(sql).toMatch(/management_onboarding_queue/i);
    expect(sql).toMatch(/get_retentio_ops_config/i);
    expect(sql).toMatch(/provisioned/i);
    expect(sql).toMatch(/cancelled/i);
    expect(sql).toMatch(/management_onboarding_submissions_deny_all/i);
  });
});

describe("management onboarding gaps migration", () => {
  it("extends KPIs with PIX revenue and submission RPC", () => {
    const sql = readFileSync(
      join(
        root,
        "supabase/migrations/20260625150000_management_onboarding_gaps.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/platform_management_subscribers_kpis/i);
    expect(sql).toMatch(/management_payment_method\s*=\s*'pix'/i);
    expect(sql).toMatch(/mrr_pix_cents/i);
    expect(sql).toMatch(/get_management_onboarding_submission/i);
  });
});

describe("notifyManagementPaid hook contract", () => {
  it("creates alert and action_center task on payment", () => {
    const src = readFileSync(
      join(root, "supabase/functions/_shared/management-paid-hook.ts"),
      "utf8",
    );
    expect(src).toMatch(/diagnosis_management_paid/);
    expect(src).toMatch(/action_center/);
    expect(src).toMatch(/management_paid_onboarding/);
    expect(src).toMatch(/management_ops_notified_at/);
  });
});
