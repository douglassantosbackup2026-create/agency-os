#!/usr/bin/env node
/**
 * Ativa preço de teste R$ 1,00 no funil /gestao-trafego (produção).
 * Uso: node scripts/ops-set-lead-test-price.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() || "uvuotaxikuxejfeitlaw";

console.log("[ops] Definindo LEAD_MANAGEMENT_PRICE_CENTS=100 no Supabase…");
const secret = spawnSync(
  "npx",
  ["supabase", "secrets", "set", "LEAD_MANAGEMENT_PRICE_CENTS=100", "--project-ref", projectRef],
  { cwd: root, stdio: "inherit", shell: true },
);
if (secret.status !== 0) process.exit(secret.status ?? 1);

console.log("[ops] Deploy Worker com VITE_LEAD_MANAGEMENT_PRICE_CENTS=100…");
const deploy = spawnSync("npm", ["run", "ops:deploy-worker"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_LEAD_MANAGEMENT_PRICE_CENTS: "100" },
});
if (deploy.status !== 0) {
  console.error(
    "[ops] Deploy falhou — confira CLOUDFLARE_API_TOKEN no .env. Secret Supabase já está em R$ 1.",
  );
  process.exit(deploy.status ?? 1);
}

console.log("[ops] Preço de teste activo. Valide: npm run ops:lead-price-smoke");
console.log("[ops] Reverter: node scripts/ops-revert-lead-price.mjs");
