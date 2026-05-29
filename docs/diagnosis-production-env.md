# Diagnóstico Meta — produção (secrets e URLs)

Fonte de verdade do funil: **app principal** (`/`, `/checkout`, `/obrigado`, `/diagnostico/$id`, `/gestao-obrigado`). O diretório `diagnostico-meta/` está **deprecated** (não fazer deploy separado).

## Worker (frontend)

| Variável | Onde | Valor exemplo |
|----------|------|----------------|
| `VITE_PUBLIC_SITE_URL` | Wrangler / `.env` | `https://tanstack-start-app.douglaspinheirosantos94.workers.dev` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Worker | Projeto `uvuotaxikuxejfeitlaw` |

Deploy: `npm run ops:deploy-worker` (injeta `VITE_PUBLIC_SITE_URL` se ausente).

## Edge Functions (Supabase secrets)

| Secret | Obrigatório |
|--------|-------------|
| `PUBLIC_SITE_URL` ou `SITE_URL` | Sim — mesmo host que o Worker |
| `MERCADOPAGO_ACCESS_TOKEN` | Sim |
| `MERCADOPAGO_WEBHOOK_SECRET` | Sim (webhook fail-closed) |
| `META_APP_ID`, `META_APP_SECRET` | Sim |
| `OAUTH_STATE_SECRET` | Sim (≥ 16 chars) |
| `CRON_SECRET` | Sim — `process-diagnosis` + fire-and-forget pós-OAuth |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Sim |
| `META_TEST_ENABLED` | **false** ou ausente em prod |
| `DIAGNOSIS_PRICE_CENTS`, `MANAGEMENT_PRICE_CENTS` | Opcional |

Script (requer `supabase login`):

```bash
PUBLIC_SITE_URL=https://tanstack-start-app.douglaspinheirosantos94.workers.dev npm run ops:diagnosis-secrets
```

## Meta OAuth redirect URI

`https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/meta-oauth-callback`

## Cron `process-diagnosis`

Ver [`ops-cron-deploy-checklist.md`](ops-cron-deploy-checklist.md). Job `process-diagnosis-batch` (*/5).

Batch: `PROCESS_DIAGNOSIS_BATCH_SIZE` (default **10**, máx. 25 na função).

## Validação rápida

```bash
npm run ops:diagnosis-health
# ou
node scripts/diagnosis-health-check.mjs --url https://tanstack-start-app.douglaspinheirosantos94.workers.dev
```
