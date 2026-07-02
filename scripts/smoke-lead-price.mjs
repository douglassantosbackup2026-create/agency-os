#!/usr/bin/env node
/**
 * Smoke: preço do funil lead (submit + start-lead-payment amount_cents).
 * Uso: EXPECT_LEAD_PRICE_CENTS=100 node scripts/smoke-lead-price.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://agencyopus.live";
const EXPECT = Number(process.env.EXPECT_LEAD_PRICE_CENTS ?? 499700);
let failed = 0;

function check(label, ok) {
  if (ok) console.log(`OK   ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failed++;
  }
}

const priceSrc = fs.readFileSync(
  path.join(root, "src/lib/lead-management-price.ts"),
  "utf8",
);
check("lead-management-price reads VITE env", /VITE_LEAD_MANAGEMENT_PRICE_CENTS/.test(priceSrc));

const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.log("SKIP HTTP smoke (sem .env)");
} else {
  const env = fs.readFileSync(envPath, "utf8");
  const base = (env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/\/+$/, "");
  const key = (env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1] ?? "").trim();
  if (!base || !key) {
    console.log("SKIP HTTP smoke (VITE_SUPABASE_URL ou key ausente)");
  } else {
    const headers = {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Origin: ORIGIN,
    };

    const submitRes = await fetch(`${base}/functions/v1/submit-ecommerce-lead`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Smoke Price Test",
        email: `smoke-price-${Date.now()}@example.com`,
        phone: "11999999999",
        store_name: "Loja Smoke",
        website: "https://example.com",
        monthly_ad_budget_range: "5k-15k",
        source: "smoke-lead-price",
      }),
    });
    check(`submit-ecommerce-lead ${submitRes.status}`, submitRes.ok);
    const submitBody = submitRes.ok ? await submitRes.json() : null;
    const leadId = submitBody?.lead_id;
    const accessSlug = submitBody?.access_slug;

    if (leadId && accessSlug) {
      const startRes = await fetch(`${base}/functions/v1/start-lead-payment`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          lead_id: leadId,
          access_slug: accessSlug,
          payer: {
            name: "Smoke Price Test",
            email: submitBody?.email ?? "smoke@example.com",
            cpf: "39053344705",
            phone: "11999999999",
          },
        }),
      });
      check(`start-lead-payment ${startRes.status}`, startRes.ok);
      if (startRes.ok) {
        const startBody = await startRes.json();
        check(
          `amount_cents=${EXPECT}`,
          Number(startBody.amount_cents) === EXPECT,
        );
        if (Number(startBody.amount_cents) !== EXPECT) {
          console.error(`     got amount_cents=${startBody.amount_cents}`);
        }
      }
    }
  }
}

if (failed) {
  console.error(`\n[smoke-lead-price] ${failed} failure(s).`);
  process.exit(1);
}
console.log("\n[smoke-lead-price] OK.");
