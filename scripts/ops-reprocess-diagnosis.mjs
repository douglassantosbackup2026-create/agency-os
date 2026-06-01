#!/usr/bin/env node
/**
 * Dispara process-diagnosis (batch) para diagnósticos em status `processing`.
 * Uso: node scripts/ops-reprocess-diagnosis.mjs
 * Requer CRON_SECRET e SUPABASE_URL + chave anon no .env
 *
 * Para um ID específico, antes enfileire no banco (service role ou SQL Editor):
 *   UPDATE public.diagnoses SET status='processing', failed_reason=NULL, updated_at=now()
 *   WHERE id='<uuid>';
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
const cronSecret = env.CRON_SECRET?.trim();
const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/$/, "");
const anonKey =
  env.SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.SUPABASE_PUBLISHABLE_KEY;

if (!cronSecret || !supabaseUrl || !anonKey) {
  console.error(
    "Defina CRON_SECRET, SUPABASE_URL (ou VITE_SUPABASE_URL) e anon key no .env",
  );
  process.exit(1);
}

if (process.argv[2]?.trim()) {
  console.warn(
    "Aviso: process-diagnosis só processa fila status=processing. Enfileire o UUID via SQL (runbook v12) antes do POST.",
  );
}
const url = `${supabaseUrl}/functions/v1/process-diagnosis`;
const body = {};

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${cronSecret}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(res.status, text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
