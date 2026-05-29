#!/usr/bin/env node
/**
 * Alinha CRON_SECRET das Edge Functions com retentio_ops_config.cron_bearer.
 * Requer: SUPABASE_ACCESS_TOKEN + SUPABASE_SERVICE_ROLE_KEY
 */
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() || "uvuotaxikuxejfeitlaw";
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!serviceKey) {
  console.error("Defina SUPABASE_SERVICE_ROLE_KEY.");
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
  console.error("Bearer inválido. Corra bootstrap_retentio_cron_jobs() primeiro.");
  process.exit(1);
}

if (!accessToken) {
  console.log(
    "Bearer obtido (48 chars). Defina SUPABASE_ACCESS_TOKEN e volte a correr para gravar CRON_SECRET.",
  );
  console.log(
    "Alternativa Dashboard: Edge Functions → Secrets → CRON_SECRET = valor de get_retentio_cron_bearer().",
  );
  process.exit(0);
}

const mgmtRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secrets: [{ name: "CRON_SECRET", value: bearer }],
    }),
  },
);

if (!mgmtRes.ok) {
  console.error("Falha ao definir CRON_SECRET:", mgmtRes.status, await mgmtRes.text());
  process.exit(1);
}

console.log("CRON_SECRET alinhado com retentio_ops_config (Management API).");

const verifyRes = await fetch(
  `https://${projectRef}.supabase.co/functions/v1/cron-dispatch-agency-jobs`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ jobs: "process-ai-jobs", dry_run: true }),
  },
);

console.log(
  "Smoke cron-dispatch:",
  verifyRes.status,
  verifyRes.status === 401 ? "(auth falhou — aguarde redeploy secrets ~1min)" : "OK",
);
