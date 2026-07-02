#!/usr/bin/env node
/**
 * Smoke: contrato do notifyLeadPaid e migration ecommerce_lead_ops.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const hookSrc = readFileSync(
  resolve(root, "supabase/functions/_shared/lead-paid-hook.ts"),
  "utf8",
);

const requiredHookPatterns = [
  /ops_notified_at/,
  /ecommerce_lead_paid/,
  /should_create_task:\s*true/,
  /action_center/,
  /lead_paid_onboarding/,
];

let failed = 0;
for (const re of requiredHookPatterns) {
  if (!re.test(hookSrc)) {
    console.error(`FAIL lead hook missing pattern: ${re}`);
    failed++;
  }
}

const migrationPath = resolve(
  root,
  "supabase/migrations/20260702160000_ecommerce_lead_ops.sql",
);
if (!existsSync(migrationPath)) {
  console.error("FAIL migration 20260702160000_ecommerce_lead_ops.sql missing");
  failed++;
} else {
  const sql = readFileSync(migrationPath, "utf8");
  const requiredSql = [
    /access_slug/,
    /ops_notified_at/,
    /provisioned_at/,
    /ecommerce_lead_id/,
    /clients_ecommerce_lead_id_unique_idx/,
  ];
  for (const re of requiredSql) {
    if (!re.test(sql)) {
      console.error(`FAIL migration missing pattern: ${re}`);
      failed++;
    }
  }
}

const provisionSrc = readFileSync(
  resolve(root, "supabase/functions/provision-lead-client/index.ts"),
  "utf8",
);
if (!/ecommerce_lead_id/.test(provisionSrc)) {
  console.error("FAIL provision-lead-client missing ecommerce_lead_id");
  failed++;
}

const webhookSrc = readFileSync(
  resolve(root, "supabase/functions/mercadopago-webhook/index.ts"),
  "utf8",
);
if (!/notifyLeadPaid/.test(webhookSrc)) {
  console.error("FAIL mercadopago-webhook missing notifyLeadPaid");
  failed++;
}

if (failed === 0) {
  console.log("OK   lead-paid-hook contract");
  console.log("OK   ecommerce_lead_ops migration contract");
  console.log("OK   provision-lead-client contract");
  console.log("OK   webhook integration");
  console.log("\n[lead-paid-hook-smoke] Contrato OK.");
} else {
  process.exit(1);
}
