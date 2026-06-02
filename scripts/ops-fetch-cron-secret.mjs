#!/usr/bin/env node
/**
 * Obtém o bearer de cron (retentio_ops_config) para colar no .env como CRON_SECRET.
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/ops-fetch-cron-secret.mjs
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
  env.SUPABASE_PROJECT_REF?.trim() || "uvuotaxikuxejfeitlaw";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!serviceKey) {
  console.error(
    "Defina SUPABASE_SERVICE_ROLE_KEY no .env (Dashboard → API → service_role).",
  );
  process.exit(1);
}

const rpcRes = await fetch(
  `https://${projectRef}.supabase.co/rest/v1/rpc/get_retentio_cron_bearer`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: "{}",
  },
);

if (!rpcRes.ok) {
  console.error("Falha ao ler bearer:", rpcRes.status, await rpcRes.text());
  process.exit(1);
}

const bearer = (await rpcRes.text()).replace(/^"|"$/g, "").trim();
if (!bearer || bearer.length < 8) {
  console.error("Bearer inválido. Execute bootstrap_retentio_cron_jobs() antes.");
  process.exit(1);
}

console.log(`CRON_SECRET=${bearer}`);
console.error(
  "Cole a linha acima no .env (não commitar). Depois: UPDATE diagnoses SET status='processing' ... → npm run ops:reprocess-diagnosis",
);
