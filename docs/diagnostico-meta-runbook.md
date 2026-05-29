# Runbook — Diagnóstico Meta (funil no app principal)

**Estado:** 2026-06 — fonte de verdade no **app principal** (`src/routes/`: `/`, `/checkout`, `/obrigado`, `/diagnostico/$id`, `/gestao-obrigado`). O pacote `diagnostico-meta/` está **deprecated** (não deployar em `:5180`).

Produção Worker: `https://tanstack-start-app.douglaspinheirosantos94.workers.dev`  
Supabase: `uvuotaxikuxejfeitlaw`

Ver também: [`diagnosis-production-env.md`](diagnosis-production-env.md), [`diagnostico-smoke-log.md`](diagnostico-smoke-log.md), [`diagnostico-performance.md`](diagnostico-performance.md), [`github-secrets-e2e-diagnosis.md`](github-secrets-e2e-diagnosis.md).

## Edge Functions (`verify_jwt = false`)

Configuradas em `supabase/config.toml`: `create-diagnosis-checkout`, `start-diagnosis-payment`, `diagnosis-status`, `diagnosis-report`, `meta-oauth`, `meta-oauth-callback`, `process-diagnosis`, `create-management-checkout`, `mercadopago-webhook` (partilhado), `meta-api-test` (só com `META_TEST_ENABLED`).

Cada endpoint público valida `secret_slug` / rate limit / `CRON_SECRET` (cron) conforme a função.

## Secrets (Supabase)

| Secret | Uso |
|--------|-----|
| `PUBLIC_SITE_URL` ou `SITE_URL` | **Obrigatório** — mesmo host que o Worker; MP `back_urls` e OAuth |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Checkout + webhook (fail-closed sem secret) |
| `META_APP_ID`, `META_APP_SECRET`, `OAUTH_STATE_SECRET` | OAuth (state ≥ 16 chars) |
| `CRON_SECRET` | `process-diagnosis` + disparo pós-`meta-oauth-callback` |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Análise IA |
| `META_TEST_ENABLED` | **false** ou ausente em prod |
| `DIAGNOSIS_PRICE_CENTS`, `MANAGEMENT_PRICE_CENTS` | Opcional |
| `PROCESS_DIAGNOSIS_BATCH_SIZE` | Opcional (default **10**, máx. 25) |
| `PUBLIC_RATE_LIMIT_MAX_PER_WINDOW`, `PUBLIC_RATE_LIMIT_WINDOW_MS` | Default 30 / 60s — checkout público |

Redirect URI Meta: `https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/meta-oauth-callback`

## Cron `process-diagnosis`

- Job SQL: `process-diagnosis-batch` (ver [`ops-cron-deploy-checklist.md`](ops-cron-deploy-checklist.md)).
- Aplicar: `npm run ops:apply-crons` (requer `SUPABASE_SERVICE_ROLE_KEY` ou bearer em `retentio_ops_config`).
- Invocação manual: `POST .../functions/v1/process-diagnosis` com `Authorization: Bearer <CRON_SECRET>` e `apikey: <ANON_KEY>`.

No início de cada batch, a função chama `cleanup_stale_diagnosis_processing(30)` (migration `20260605120000`).

## Queries operacionais

Diagnósticos presos em `processing` (> 30 min):

```sql
SELECT id, status, failed_reason, updated_at
FROM public.diagnoses
WHERE status = 'processing'
  AND updated_at < now() - interval '30 minutes';
```

Snapshot agregado (service role):

```sql
SELECT public.get_diagnosis_ops_snapshot();
```

Limpeza manual:

```sql
SELECT public.cleanup_stale_diagnosis_processing(30);
```

## Rate limit (429)

Endpoints: `create-diagnosis-checkout`, `start-diagnosis-payment` (`public-rate-limit.ts`).

Teste em staging: >30 POST/min do mesmo IP → esperar **429**. Documentar limites via `PUBLIC_RATE_LIMIT_*`.

## Segundo checkout (gestão)

- `external_reference` `mgmt:{uuid}` no webhook MP (não altera `mp_payment_id` do diagnóstico).
- Páginas: `/diagnostico/$id`, `/gestao-obrigado?d=&s=`.

## RLS

`diagnoses`, `diagnosis_secrets`, `diagnosis_reports`: política `block_all` — apenas **service role** nas Edge Functions.

## Segurança

| Item | Estado |
|------|--------|
| Webhook MP sem secret | 401/403 |
| `META_TEST_ENABLED` em prod | Desligado; rota `/test-meta-oauth` redirecciona para `/` salvo `VITE_META_TEST_ENABLED` em dev |
| Turnstile no checkout | **P2 opcional** — Cloudflare Turnstile em `create-diagnosis-checkout` |
| Logs OAuth | Não logar `access_token` em callbacks |

## Smoke e E2E

- Manual: [`diagnostico-smoke-log.md`](diagnostico-smoke-log.md)
- CI: `e2e/diagnosis-funnel.spec.ts` (contratos + rotas públicas)
- Health: `npm run ops:diagnosis-health`

## Falhas IA

Timeout Claude 60s em `process-diagnosis`. Falha após providers → `status = failed` com `failed_reason`. Retry: novo diagnóstico ou operador reinvoca cron após corrigir token Meta.

## Suporte

- `failed_reason` em `diagnoses`
- Logs Edge Functions + `edge-trace` (`trace_id` nos headers de resposta)
