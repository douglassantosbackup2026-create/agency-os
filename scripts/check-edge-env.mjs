#!/usr/bin/env node
/**
 * Valida secrets de CORS para Edge Functions em produção.
 * Exige PUBLIC_SITE_URL ou APP_ALLOWED_ORIGINS antes de deploy.
 *
 * Uso:
 *   node scripts/check-edge-env.mjs --require-prod
 */
const requireProd = process.argv.includes("--require-prod");

const site =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.VITE_PUBLIC_SITE_URL?.trim() ||
  process.env.SITE_URL?.trim();
const extras = process.env.APP_ALLOWED_ORIGINS?.trim();

if (site || extras) {
  console.log("[security] Edge CORS allowlist OK.");
  process.exit(0);
}

const msg =
  "[security] Defina PUBLIC_SITE_URL (ou APP_ALLOWED_ORIGINS) antes de deploy de Edge Functions em produção.";

if (requireProd) {
  console.error(msg);
  process.exit(1);
}

console.warn(msg);
process.exit(0);
