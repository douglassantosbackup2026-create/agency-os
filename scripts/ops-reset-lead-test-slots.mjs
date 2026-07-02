#!/usr/bin/env node
/**
 * Libera vagas consumidas por leads de teste (R$ 1 / smoke) pagos no mês corrente.
 * Uso: node scripts/ops-reset-lead-test-slots.mjs
 * Requer SUPABASE_SERVICE_ROLE_KEY no .env
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

function isTestLead(row) {
  const email = String(row.email ?? "");
  const source = String(row.source ?? "");
  const cents = Number(row.amount_cents ?? 0);
  return (
    cents === 100 ||
    source === "smoke-lead-price" ||
    source === "smoke-lead-submit" ||
    /^smoke-.*@example\.com$/i.test(email)
  );
}

const env = loadEnv();
const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/+$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error(
    "[ops-reset-lead-test-slots] Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env",
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: beforeSnap, error: beforeErr } = await sb.rpc(
  "get_ecommerce_lead_slot_snapshot",
  { p_cap: 3 },
);
if (beforeErr) {
  console.error("[ops-reset-lead-test-slots] snapshot before failed", beforeErr);
  process.exit(1);
}

const { data: monthStart, error: monthErr } = await sb.rpc("lead_month_start_sao_paulo");
if (monthErr || !monthStart) {
  console.error("[ops-reset-lead-test-slots] month start failed", monthErr);
  process.exit(1);
}

const { data: rows, error: qErr } = await sb
  .from("ecommerce_leads")
  .select("id, email, source, amount_cents, paid_at")
  .eq("status", "paid")
  .gte("paid_at", monthStart);

if (qErr) {
  console.error("[ops-reset-lead-test-slots] query failed", qErr);
  process.exit(1);
}

const targets = (rows ?? []).filter(isTestLead);

if (targets.length === 0) {
  console.log("[ops-reset-lead-test-slots] Nenhum lead de teste paid neste mês.");
} else {
  console.log(`[ops-reset-lead-test-slots] Resetando ${targets.length} lead(s) de teste…`);
  for (const row of targets) {
    const { error: upErr } = await sb
      .from("ecommerce_leads")
      .update({
        status: "new",
        paid_at: null,
        mp_payment_id: null,
        mp_preapproval_id: null,
        payment_method: null,
        amount_cents: null,
        ops_notified_at: null,
        pix_qr_code: null,
        pix_qr_code_base64: null,
        pix_expires_at: null,
      })
      .eq("id", row.id)
      .eq("status", "paid");
    if (upErr) {
      console.error(`  FAIL ${row.id}`, upErr.message);
      process.exit(1);
    }
    console.log(`  OK   ${row.id} (${row.email ?? row.source ?? "?"})`);
  }
}

const { data: afterSnap, error: afterErr } = await sb.rpc(
  "get_ecommerce_lead_slot_snapshot",
  { p_cap: 3 },
);
if (afterErr) {
  console.error("[ops-reset-lead-test-slots] snapshot after failed", afterErr);
  process.exit(1);
}

console.log("\n[ops-reset-lead-test-slots] Antes:", beforeSnap);
console.log("[ops-reset-lead-test-slots] Depois:", afterSnap);
console.log(
  `[ops-reset-lead-test-slots] OK — ${targets.length} reset(s), available=${afterSnap?.available ?? "?"}`,
);
