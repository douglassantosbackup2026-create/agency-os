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

## Diagnóstico por objetivo de campanha (v8)

- **Prompt:** `diagnosis-ecommerce-v8` em `process-diagnosis` (invalida `analysis_json` antigo ao reprocessar).
- **Facts:** `campaigns_enriched` + `objective_spend_mix` em `diagnosis_reports.facts_json` (join `campaign.objective` da API + insights).
- **Semáforo:** por família (Vendas → ROAS; Tráfego → custo/page view; Reconhecimento → alcance/CPM; etc.) — não julgar alcance com ROAS de compra.
- **UI:** `/diagnostico/$id` — secção “Como sua conta está organizada”, métricas de Vendas, tabela com Objetivo / Resultados / Custo por resultado.
- **Código compartilhado:** `supabase/functions/_shared/diagnosis/campaign-objective.ts`, `derive-analysis.ts`.
- **Testes:** `npm test -- supabase/functions/_shared/diagnosis/campaign-objective.test.ts`

## Narrativa comercial / pitch consultoria (v9)

- **Prompt:** `diagnosis-ecommerce-v9` — narrativa AIDA; `commercial_derived` no user prompt (perda/recuperação em R$ só do servidor).
- **Facts:** `commercial_derived` em `facts_json` (economics, waste, recovery, benchmarks, scoreExplanation, storyExecutive).
- **analysis_json:** `financialImpact`, `storyExecutive`, `scoreExplanation`, `benchmarkComparison`, `narrativeHook`, `executiveSummary`, `criticalIssues[].cause|consequence|financialNote`, `budgetLeaks[].monthlyBrl`.
- **UI:** hero “Dinheiro em jogo”, resumo executivo, benchmark de mercado, cards causa→impacto, detalhe técnico colapsável, autoridade + CTA por perda mensal.
- **Código:** `derive-commercial.ts` + testes `derive-commercial.test.ts`.
- **Reprocessar:** relatórios com `prompt_version` &lt; v9 precisam de novo `process-diagnosis` (cron ou `POST` com `CRON_SECRET`).

## Veredito editorial premium (v10)

- **Prompt:** `diagnosis-ecommerce-v10` — `verdictLine` única; `top_findings` e `financial_balance` no user prompt (compacto); proibido alterar BRL do servidor.
- **Servidor:** `derive-top-findings.ts`, `derive-financial-balance.ts`; `benchmarkComparison.gaps[]` com `deltaLabel` e `isBad`.
- **analysis_json:** `topFindings`, `financialBalance`, `verdictLine` (fallback em `normalizeAnalysisV2` se IA omitir).
- **UI:** veredito + top 3 achados por campanha + balanço 30d + benchmark com delta (Lucide); autoridade após benchmark; capa PDF em `@media print`; toolbar sticky sem emojis.
- **Legado:** relatórios sem `topFindings` usam fallback no client + banner; reprocessar para v10.
- **Testes:** `derive-top-findings.test.ts` + `derive-commercial.test.ts`.

```bash
npm test -- supabase/functions/_shared/diagnosis/
npx supabase functions deploy process-diagnosis --project-ref uvuotaxikuxejfeitlaw
# Worker (requer sessão Cloudflare): npx wrangler login && npm run ops:deploy-worker
```

**Reprocessar após v10:** qualquer relatório com `prompt_version != diagnosis-ecommerce-v10`.

### Validar conta mista (ex.: Conversão + Geo + Meio)

1. Reprocessar diagnóstico (`process-diagnosis` ou novo checkout).
2. Relatório: chips de funil com % por objetivo; ROAS só na linha **Vendas**.
3. `sales_block`: CPA ≈ gasto_vendas / compras (não misturar gasto de alcance/tráfego).
4. Campanha de alcance: status não “sem tracking” vermelho por ROAS `—`.

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
