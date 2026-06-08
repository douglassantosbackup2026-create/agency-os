#!/usr/bin/env node
/**
 * Define secrets do funil Diagnóstico no Supabase (requer supabase login ou access token).
 *
 * Uso:
 *   PUBLIC_SITE_URL=https://tanstack-start-app....workers.dev node scripts/ops-set-diagnosis-secrets.mjs
 *   node scripts/ops-set-diagnosis-secrets.mjs --require-prod
 *
 * Opcional: MERCADOPAGO_ACCESS_TOKEN, OAUTH_STATE_SECRET, CRON_SECRET, ANTHROPIC_API_KEY
 */
import { spawnSync } from "node:child_process";

const requireProd = process.argv.includes("--require-prod");
if (requireProd) {
  const check = spawnSync(
    "node",
    ["scripts/check-edge-env.mjs", "--require-prod"],
    { stdio: "inherit" },
  );
  if (check.status !== 0) process.exit(check.status ?? 1);
}

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() || "uvuotaxikuxejfeitlaw";

const site =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.VITE_PUBLIC_SITE_URL?.trim() ||
  (requireProd
    ? ""
    : "https://tanstack-start-app.douglaspinheirosantos94.workers.dev");

if (!site) {
  console.error("[security] PUBLIC_SITE_URL é obrigatório com --require-prod.");
  process.exit(1);
}

const pairs = [
  ["PUBLIC_SITE_URL", site],
  ["SITE_URL", site],
];

for (const [key, val] of [
  ["MERCADOPAGO_ACCESS_TOKEN", process.env.MERCADOPAGO_ACCESS_TOKEN],
  ["MERCADOPAGO_WEBHOOK_SECRET", process.env.MERCADOPAGO_WEBHOOK_SECRET],
  ["META_APP_ID", process.env.META_APP_ID],
  ["META_APP_SECRET", process.env.META_APP_SECRET],
  ["OAUTH_STATE_SECRET", process.env.OAUTH_STATE_SECRET],
  ["CRON_SECRET", process.env.CRON_SECRET],
  ["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY],
  ["CLAUDE_MODEL", process.env.CLAUDE_MODEL],
  ["META_TEST_ENABLED", "false"],
]) {
  if (val?.trim()) pairs.push([key, val.trim()]);
}

console.log("Setting diagnosis secrets on", projectRef);
for (const [k, v] of pairs) {
  const r = spawnSync(
    "npx",
    ["supabase", "secrets", "set", `${k}=${v}`, "--project-ref", projectRef],
    { stdio: "inherit", shell: true },
  );
  if (r.status !== 0) {
    console.error(`Failed: ${k}`);
    process.exit(r.status ?? 1);
  }
}
console.log("Done. Redeploy diagnosis edge functions if needed.");
