#!/usr/bin/env node
/**
 * Smoke: contrato do notifyManagementPaid e RPCs do pipeline de gestão.
 * Sem service role — valida fonte + migration; opcionalmente RPC anon bloqueada.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const path = existsSync(resolve(root, ".env"))
    ? resolve(root, ".env")
    : resolve(root, ".env.example");
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return { ...out, ...process.env };
}

const hookSrc = readFileSync(
  resolve(root, "supabase/functions/_shared/management-paid-hook.ts"),
  "utf8",
);

const requiredHookPatterns = [
  /management_ops_notified_at/,
  /diagnosis_management_paid/,
  /should_create_task:\s*true/,
  /action_center/,
  /management_paid_onboarding/,
  /management_onboarding_status:\s*"awaiting_client"/,
];

let failed = 0;
for (const re of requiredHookPatterns) {
  if (!re.test(hookSrc)) {
    console.error(`FAIL hook missing pattern: ${re}`);
    failed++;
  }
}

const gapsSql = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260625150000_management_onboarding_gaps.sql",
  ),
  "utf8",
);

const requiredSqlPatterns = [
  /platform_management_subscribers_kpis/,
  /management_payment_method\s*=\s*'pix'/,
  /mrr_pix_cents/,
  /get_management_onboarding_submission/,
  /LATERAL/,
];

for (const re of requiredSqlPatterns) {
  if (!re.test(gapsSql)) {
    console.error(`FAIL gaps migration missing pattern: ${re}`);
    failed++;
  }
}

if (failed === 0) {
  console.log("OK   management-paid-hook contract");
  console.log("OK   gaps migration contract");
}

const env = loadEnv();
const projectRef =
  env.SUPABASE_PROJECT_REF?.trim() ||
  env.VITE_SUPABASE_PROJECT_ID?.trim() ||
  "uvuotaxikuxejfeitlaw";
const anonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (anonKey) {
  const base = `https://${projectRef}.supabase.co/rest/v1/rpc`;
  const res = await fetch(`${base}/get_management_onboarding_submission`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      p_diagnosis_id: "00000000-0000-0000-0000-000000000001",
    }),
  });
  if (res.status === 200) {
    console.error(
      "FAIL get_management_onboarding_submission → 200 (anon não devia ter acesso)",
    );
    failed++;
  } else {
    console.log(`OK   get_management_onboarding_submission → ${res.status}`);
  }
} else {
  console.log("SKIP anon RPC check (sem VITE_SUPABASE_PUBLISHABLE_KEY)");
}

if (failed > 0) {
  console.error(`\n[management-paid-hook-smoke] ${failed} falha(s).`);
  process.exit(1);
}

console.log("\n[management-paid-hook-smoke] Contrato OK.");
