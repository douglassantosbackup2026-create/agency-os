#!/usr/bin/env node
/**
 * Restaura preço R$ 4.997 no funil /gestao-trafego.
 * Uso: node scripts/ops-revert-lead-price.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() || "uvuotaxikuxejfeitlaw";

console.log("[ops] Restaurando LEAD_MANAGEMENT_PRICE_CENTS=499700 no Supabase…");
const secret = spawnSync(
  "npx",
  [
    "supabase",
    "secrets",
    "set",
    "LEAD_MANAGEMENT_PRICE_CENTS=499700",
    "--project-ref",
    projectRef,
  ],
  { cwd: root, stdio: "inherit", shell: true },
);
if (secret.status !== 0) process.exit(secret.status ?? 1);

console.log("[ops] Deploy Worker sem override de preço (default R$ 4.997)…");
const deploy = spawnSync("npm", ["run", "ops:deploy-worker"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_LEAD_MANAGEMENT_PRICE_CENTS: "" },
});
if (deploy.status !== 0) {
  console.error(
    "[ops] Deploy falhou — secret já restaurado. Defina CLOUDFLARE_API_TOKEN e rode npm run ops:deploy-worker",
  );
  process.exit(deploy.status ?? 1);
}

console.log("[ops] Preço restaurado. Valide: EXPECT_LEAD_PRICE_CENTS=499700 npm run ops:lead-price-smoke");
