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
check("lead-slots-shared waitlist", /waitlist_display/.test(sharedSrc));
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
check("obrigado waitlist copy", /formatLeadWaitlistUrgency/.test(obrigadoSrc));

const pixelSrc = fs.readFileSync(path.join(root, "src/lib/meta-pixel.ts"), "utf8");
check("meta-pixel gestao value from lead price", /leadManagementPriceBrl\(\)/.test(pixelSrc));
check(
  "meta-pixel InitiateCheckout on gestao-trafego-checkout",
  /gestao-trafego-checkout/.test(pixelSrc) && /trackMetaInitiateCheckout\(GESTAO_PRODUCT/.test(pixelSrc),
);

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
      check("waitlist_display >= 28", typeof j.waitlist_display === "number" && j.waitlist_display >= 28);
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      Origin: "https://agencyopus.live",
    };
    const submitRes = await fetch(`${base}/functions/v1/submit-ecommerce-lead`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "E2E Smoke",
        email: `e2e-smoke-${Date.now()}@example.com`,
        phone: "11999999999",
        store_name: "Loja E2E",
        website: "https://example.com",
        monthly_ad_budget_range: "5k-15k",
        source: "smoke-e2e",
      }),
    });
    check("e2e submit-ecommerce-lead", submitRes.ok);
    if (submitRes.ok) {
      const submitBody = await submitRes.json();
      const { lead_id: leadId, access_slug: accessSlug } = submitBody;
      check("e2e lead_id + access_slug", Boolean(leadId && accessSlug));
      if (leadId && accessSlug) {
        const statusRes = await fetch(
          `${base}/functions/v1/lead-payment-status?lead=${encodeURIComponent(leadId)}&s=${encodeURIComponent(accessSlug)}`,
          { headers: { apikey: anon, Authorization: `Bearer ${anon}`, Origin: "https://agencyopus.live" } },
        );
        check("e2e lead-payment-status", statusRes.ok);
        if (statusRes.ok) {
          const statusBody = await statusRes.json();
          check("e2e status not paid yet", statusBody.status !== "paid");
          check("e2e status has slots", statusBody.slots?.available != null);
        }
        const startRes = await fetch(`${base}/functions/v1/start-lead-payment`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            lead_id: leadId,
            access_slug: accessSlug,
            payer: {
              name: "E2E Smoke",
              email: submitBody.email ?? "e2e@example.com",
              cpf: "39053344705",
              phone: "11999999999",
            },
          }),
        });
        check("e2e start-lead-payment", startRes.ok);
        if (startRes.ok) {
          const startBody = await startRes.json();
          check("e2e mp_public_key present", Boolean(startBody.mp_public_key));
          check("e2e amount_cents > 0", Number(startBody.amount_cents) > 0);
        }
      }
    }
  }
}

if (failed) {
  console.error(`\n[smoke-lead-slots] ${failed} failure(s).`);
  process.exit(1);
}
console.log("\n[smoke-lead-slots] OK.");
