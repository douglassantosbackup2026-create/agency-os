#!/usr/bin/env node
/**
 * Smoke: CORS do submit-ecommerce-lead + POST com Origin agencyopus.live.
 * Uso: node scripts/smoke-lead-submit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://agencyopus.live";

let failed = 0;

const corsSrc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/diagnosis/cors.ts"),
  "utf8",
);
if (/list\[0\]/.test(corsSrc)) {
  console.error("FAIL diagnosis/cors.ts still uses list[0] CORS fallback");
  failed++;
} else {
  console.log("OK   diagnosis/cors.ts CORS fallback");
}

const allowlistSrc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/cors-allowlist.ts"),
  "utf8",
);
if (/list\[0\]/.test(allowlistSrc)) {
  console.error("FAIL cors-allowlist.ts still uses list[0] CORS fallback");
  failed++;
} else {
  console.log("OK   cors-allowlist.ts CORS fallback");
}

const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) {
  console.log("SKIP HTTP smoke (sem .env)");
} else {
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }

  const base = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || "";

  if (!base || !key) {
    console.log("SKIP HTTP smoke (faltam VITE_SUPABASE_URL / chave no .env)");
  } else {
    const url = `${base}/functions/v1/submit-ecommerce-lead`;
    const body = JSON.stringify({
      name: "Smoke Test",
      email: `smoke-${Date.now()}@example.com`,
      phone: "11999999999",
      store_name: "Loja Smoke",
      website: "https://example.com",
      monthly_ad_budget_range: "5k-15k",
      source: "smoke",
    });

    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,apikey,authorization",
      },
    });
    const preflightAco = preflight.headers.get("access-control-allow-origin");
    if (preflight.status !== 200) {
      console.error(`FAIL OPTIONS status ${preflight.status}`);
      failed++;
    } else if (
      preflightAco !== ORIGIN &&
      preflightAco !== "*"
    ) {
      console.error(
        `FAIL OPTIONS ACAO=${preflightAco} (expected ${ORIGIN} or *)`,
      );
      failed++;
    } else {
      console.log(`OK   OPTIONS ACAO=${preflightAco}`);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Origin: ORIGIN,
      },
      body,
    });
    const aco = res.headers.get("access-control-allow-origin");
    if (aco !== ORIGIN && aco !== "*") {
      console.error(`FAIL POST ACAO=${aco} (expected ${ORIGIN} or *)`);
      failed++;
    } else {
      console.log(`OK   POST ACAO=${aco}`);
    }

    if (res.status !== 200) {
      const text = await res.text();
      console.error(`FAIL POST status ${res.status}: ${text.slice(0, 200)}`);
      failed++;
    } else {
      const json = await res.json();
      if (!json.lead_id || !json.access_slug) {
        console.error("FAIL POST body missing lead_id/access_slug");
        failed++;
      } else {
        console.log(`OK   POST 200 lead_id=${String(json.lead_id).slice(0, 8)}…`);
      }
    }
  }
}

if (failed > 0) {
  console.error(`\n[smoke-lead-submit] ${failed} failure(s).`);
  process.exit(1);
}
console.log("\n[smoke-lead-submit] OK.");
