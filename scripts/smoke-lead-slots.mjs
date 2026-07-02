#!/usr/bin/env node
/**
 * Smoke: contrato de vagas dinâmicas do funil gestao-trafego.
 * Uso: node scripts/smoke-lead-slots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function check(label, ok) {
  if (ok) console.log(`OK   ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failed++;
  }
}

const sharedSrc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/lead-slots-shared.ts"),
  "utf8",
);
check("lead-slots-shared snapshot", /getLeadSlotSnapshot/.test(sharedSrc));
check("lead-slots-shared atomic mark", /markLeadPaidIfSlotAvailable/.test(sharedSrc));

const fnSrc = fs.readFileSync(
  path.join(root, "supabase/functions/lead-available-slots/index.ts"),
  "utf8",
);
check("lead-available-slots GET handler", /GET/.test(fnSrc));

const migrationSql = fs.readFileSync(
  path.join(root, "supabase/migrations/20260702190000_lead_monthly_slots.sql"),
  "utf8",
);
check("migration slot RPCs", /try_mark_ecommerce_lead_paid/.test(migrationSql));

const checkoutSrc = fs.readFileSync(
  path.join(root, "src/routes/gestao-trafego-checkout.tsx"),
  "utf8",
);
check("checkout uses LeadFunnelSlotsBadge", /LeadFunnelSlotsBadge/.test(checkoutSrc));
check("checkout removed GESTAO_AVAILABLE_SLOTS", !/GESTAO_AVAILABLE_SLOTS/.test(checkoutSrc));

const obrigadoSrc = fs.readFileSync(
  path.join(root, "src/routes/gestao-trafego-obrigado.tsx"),
  "utf8",
);
check("obrigado uses useLeadAvailableSlots", /useLeadAvailableSlots/.test(obrigadoSrc));

const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.log("SKIP HTTP smoke (sem .env)");
} else {
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/^VITE_SUPABASE_URL=(.+)$/m);
  const keyMatch = env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m);
  const base = urlMatch?.[1]?.trim().replace(/\/+$/, "");
  const anon = keyMatch?.[1]?.trim();
  if (!base || !anon) {
    console.log("SKIP HTTP smoke (VITE_SUPABASE_URL ou key ausente)");
  } else {
    const endpoint = `${base}/functions/v1/lead-available-slots`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Origin: "https://agencyopus.live",
      },
    });
    check(`GET ${endpoint} status ${res.status}`, res.ok);
    if (res.ok) {
      const j = await res.json();
      check("response has cap/used/available", j.cap != null && j.used != null && j.available != null);
      check("available = cap - used", j.available === Math.max(0, j.cap - j.used));
    }
  }
}

if (failed) {
  console.error(`\n[smoke-lead-slots] ${failed} failure(s).`);
  process.exit(1);
}
console.log("\n[smoke-lead-slots] OK.");
