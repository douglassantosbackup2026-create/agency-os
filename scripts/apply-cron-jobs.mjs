#!/usr/bin/env node
/**
 * Agenda crons Retentio no Supabase remoto.
 *
 * Modo A (recomendado): só SUPABASE_SERVICE_ROLE_KEY — chama bootstrap_retentio_cron_jobs.
 * Modo B: CRON_SECRET explícito — chama setup_retentio_cron_jobs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const secret = process.env.CRON_SECRET?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() || "uvuotaxikuxejfeitlaw";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!serviceKey) {
  console.error(
    "Defina SUPABASE_SERVICE_ROLE_KEY para agendar crons via RPC.",
  );
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

let url;
let body;

if (secret && secret.length >= 8) {
  url = `https://${projectRef}.supabase.co/rest/v1/rpc/setup_retentio_cron_jobs`;
  body = JSON.stringify({ p_cron_bearer: secret });
} else {
  url = `https://${projectRef}.supabase.co/rest/v1/rpc/bootstrap_retentio_cron_jobs`;
  body = "{}";
  console.log(
    "CRON_SECRET não definido — bootstrap gera bearer em retentio_ops_config.",
  );
}

const res = await fetch(url, { method: "POST", headers, body });
const text = await res.text();
if (!res.ok) {
  console.error("Falha ao agendar crons:", res.status, text);
  process.exit(1);
}

console.log("Crons agendados:", text);

const verifyRes = await fetch(
  `https://${projectRef}.supabase.co/rest/v1/rpc/get_retentio_cron_bearer`,
  { method: "POST", headers, body: "{}" },
);
if (verifyRes.ok) {
  const bearer = await verifyRes.text();
  if (bearer && bearer !== "null" && bearer.length > 10) {
    console.log(
      "Bearer em retentio_ops_config activo (Edge Functions aceitam env ou DB).",
    );
  }
}

const root = dirname(fileURLToPath(import.meta.url));
const unschedulePath = join(root, "..", "supabase", "cron-jobs.unschedule-legacy.sql");
console.log(
  "Legacy unschedule incluído em setup_retentio_cron_jobs.",
  readFileSync(unschedulePath, "utf8").split("\n")[0],
);
