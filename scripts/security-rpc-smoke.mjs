#!/usr/bin/env node
/**
 * Smoke: RPCs críticas não devem responder 200 com chave anon.
 * Uso: node scripts/security-rpc-smoke.mjs
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

const env = loadEnv();
const projectRef =
  env.SUPABASE_PROJECT_REF?.trim() ||
  env.VITE_SUPABASE_PROJECT_ID?.trim() ||
  "uvuotaxikuxejfeitlaw";
const anonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!anonKey) {
  console.error("[security-rpc-smoke] Defina VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const base = `https://${projectRef}.supabase.co/rest/v1/rpc`;

const cases = [
  { rpc: "get_retentio_cron_bearer", body: {} },
  { rpc: "bootstrap_retentio_cron_jobs", body: {} },
  { rpc: "get_resilience_ops_snapshot", body: {} },
  {
    rpc: "get_agency_dashboard_snapshot",
    body: { p_agency_id: "00000000-0000-0000-0000-000000000001" },
  },
  { rpc: "claim_ai_jobs", body: { p_limit: 1 } },
  { rpc: "platform_diagnosis_buyers_list", body: {} },
];

let failed = 0;

for (const { rpc, body } of cases) {
  const res = await fetch(`${base}/${rpc}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 200) {
    console.error(`FAIL ${rpc} → ${res.status} (anon não devia ter acesso)`);
    failed++;
  } else {
    console.log(`OK   ${rpc} → ${res.status}`);
  }
}

if (failed > 0) {
  console.error(`\n[security-rpc-smoke] ${failed} falha(s).`);
  process.exit(1);
}

console.log("\n[security-rpc-smoke] Todas as RPCs críticas bloqueadas para anon.");
