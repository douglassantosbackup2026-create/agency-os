# Runbook — Diagnóstico Meta (funil no app principal)

**Estado:** 2026-06 — fonte de verdade no **app principal** (`src/routes/`: `/`, `/checkout`, `/obrigado`, `/diagnostico/$id`, `/gestao-obrigado`). O pacote `diagnostico-meta/` está **deprecated** (não deployar em `:5180`).

Produção Worker: `https://tanstack-start-app.douglaspinheirosantos94.workers.dev`  
Supabase: `uvuotaxikuxejfeitlaw`

Ver também: [`diagnosis-production-env.md`](diagnosis-production-env.md), [`diagnostico-smoke-log.md`](diagnostico-smoke-log.md), [`diagnostico-performance.md`](diagnostico-performance.md), [`github-secrets-e2e-diagnosis.md`](github-secrets-e2e-diagnosis.md).

## Edge Functions (`verify_jwt = false`)

Configuradas em `supabase/config.toml`: `create-diagnosis-checkout`, `start-diagnosis-payment`, `start-management-payment`, `process-management-payment`, `management-payment-status`, `diagnosis-status`, `diagnosis-report`, `diagnosis-context`, `diagnosis-followup`, `meta-oauth`, `meta-oauth-callback`, `process-diagnosis`, `create-management-checkout` (legacy redirect MP), `mercadopago-webhook` (partilhado), `meta-api-test` (só com `META_TEST_ENABLED`).

**Upsell gestão (transparente):** CTA do relatório → `/gestao-checkout?d&s` → `start-management-payment` + `process-management-payment` → `/gestao-obrigado`. Webhook `mgmt:<uuid>` já suportado.

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
- **Schedule actual:** `*/1 * * * *` (cada 1 min) com `PROCESS_DIAGNOSIS_BATCH_SIZE=4` — calibrado para rajadas de ~10 diagnósticos simultâneos vindos de tráfego pago, sem estourar TPM Anthropic.
- Aplicar: `npm run ops:apply-crons` (requer `SUPABASE_SERVICE_ROLE_KEY` ou bearer em `retentio_ops_config`).
- Invocação manual: `POST .../functions/v1/process-diagnosis` com `Authorization: Bearer <CRON_SECRET>` e `apikey: <ANON_KEY>`.

No início de cada batch, a função chama `cleanup_stale_diagnosis_processing(30)` (migration `20260605120000`).

## Monitoring durante tráfego pago

Queries rápidas para acompanhar a primeira hora de campanhas Meta Ads:

```sql
-- Funil de diagnósticos da última hora
SELECT status, COUNT(*) FROM diagnoses
WHERE created_at > now() - interval '1 hour'
GROUP BY status
ORDER BY COUNT(*) DESC;

-- Diagnósticos presos em processing (> 10 min)
SELECT id, status, updated_at FROM diagnoses
WHERE status = 'processing'
  AND updated_at < now() - interval '10 minutes';

-- Tempo médio awaiting_payment → completed (últimas 24h)
SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) AS minutos_medios
FROM diagnoses
WHERE status = 'completed' AND updated_at > now() - interval '24 hours';
```

Também: `SELECT public.get_resilience_ops_snapshot();` e logs de `process-diagnosis` (Supabase Dashboard → Edge Functions).



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

## Funil misto vs sobreposição (v11)

- **Prompt:** `diagnosis-ecommerce-v11` — `funnel_guidance` no user prompt (determinístico em `deriveFunnelGuidanceForAi`).
- **Regra:** campanhas com **objectives Meta diferentes** (Reconhecimento + Tráfego + Vendas) **não** são sobreposição de público; ROAS/receita **só** em campanhas de Vendas.
- **facts_json:** campo `funnel_guidance` com `mixed_funnel`, `overlap_between_objectives_is_normal`, `mandatory_rules_pt[]`.
- **Reprocessar:** relatórios que ainda citam overlap/canibalização entre Geo/Meio/Conversão precisam de novo `process-diagnosis` com v11.

### Validar conta mista (ex.: Conversão + Geo + Meio)

1. Reprocessar diagnóstico (`process-diagnosis` ou novo checkout).
2. Relatório: chips de funil com % por objetivo; ROAS só na linha **Vendas**.
3. `sales_block`: CPA ≈ gasto_vendas / compras (não misturar gasto de alcance/tráfego).
4. Campanha de alcance: status não “sem tracking” vermelho por ROAS `—`.

## Analista Sênior digitalizado (v12)

- **Prompt:** `diagnosis-ecommerce-v12` — injeta `senior_derived` (maturidade, leak por eixo, 5 capítulos, growth, risks) após `funnel_guidance`.
- **Servidor:** `derive-senior.ts` + módulos (`derive-structure/audience/creative/scale-diagnosis`, `derive-maturity`, `derive-leak-by-axis`, `derive-growth-scenarios`); números só no servidor.
- **facts_json:** `senior_derived` (espelho de `commercial_derived.seniorDerived`).
- **analysis_json:** `seniorDerived`, `maturity`, `leakByAxis`, `growthScenarios`, `chapterNarratives` (opcional da IA); `actionPlan[].engine` default `action`.
- **UI:** ordem — veredito → achados → maturidade → vazamentos por eixo → 5 capítulos (financeiro com balanço embutido) → crescimento → benchmark → anexo técnico (`<details>`).
- **Públicos Fase 1:** `dataAvailable: partial` — sem overlap entre objectives diferentes; frequência só conta/campanha.
- **Testes:** `derive-senior.test.ts` (+ suite `supabase/functions/_shared/diagnosis/`).

```bash
npm test -- supabase/functions/_shared/diagnosis/
npx supabase functions deploy process-diagnosis --project-ref uvuotaxikuxejfeitlaw
npx supabase functions deploy diagnosis-report --project-ref uvuotaxikuxejfeitlaw
```

`diagnosis-report` re-hidrata `analysis_json` com `normalizeAnalysisV2` + `facts_json` na leitura — relatórios v11/v12 antigos ganham `seniorDerived` na UI sem nova chamada à IA.

**Reprocessar após v12:** `prompt_version != diagnosis-ecommerce-v12` — banner no relatório até reprocessar.

```bash
# Reprocessar fila ou um diagnóstico específico (requer CRON_SECRET no .env)
npm run ops:reprocess-diagnosis
npm run ops:reprocess-diagnosis -- <diagnosis_uuid>
```

### QA piloto v12 (1–2 contas)

1. Listar candidatos (relatório antigo ou sem `diagnosis-ecommerce-v12`):

```sql
SELECT d.id, d.status, dr.prompt_version, d.meta_ad_account_id, d.updated_at
FROM public.diagnoses d
JOIN public.diagnosis_reports dr ON dr.diagnosis_id = d.id
WHERE d.status = 'completed'
  AND (dr.prompt_version IS DISTINCT FROM 'diagnosis-ecommerce-v12')
ORDER BY d.updated_at DESC
LIMIT 5;
```

2. Reprocessar: `npm run ops:reprocess-diagnosis -- <uuid>` (aguardar `completed`).
3. Abrir `/diagnostico/<uuid>` e validar: maturidade, card de riscos, vazamento por eixo, 5 capítulos, funil misto (Geo + Meio + Conversão quando aplicável), badges eixo/motor em problemas críticos.
4. Recarregar sem reprocessar: hidratação deve manter motores determinísticos; narrativa `chapterNarratives` só após passo 2.

**Piloto atual (2026-06-01):** `7e8e3d16-306f-4960-ace3-56de6a3f0b6a` — `facts_json` em v12 com `adsets_insights` e `seniorDerived` no servidor; se a IA falhar (timeout Anthropic / quota OpenAI), a UI v12 ainda exibe motores via hidratação em `diagnosis-report`. Reenfileirar `processing` + cron quando as chaves de IA estiverem OK para narrativa v12 completa.

## Analista v16 — Páprika (consultor + 7 blocos)

- **Prompt:** `diagnosis-ecommerce-v16` — regras em `v16-paprika-rules.ts`; doc em `diagnostico-meta/prompts/diagnosis-ecommerce-paprika-v1.md`.
- **facts_json:** `consultative_derived`, `account_financial_gap`, `delivery_summary`, `conversion_funnel`, `adset_bleed_ranking`, `adset_learning_status` (com `delivery_substatus_pt`), `ad_video_diagnostics`, `niche_context`, `account_meta`.
- **Nicho:** formulário `business_context` → heurística campanhas/conta → `account_meta.vertical` → `ecom_geral`. Benchmarks tiers em `niche-benchmarks-v1.ts`.
- **UI (apresentação):** ordem Hero → Impacto R$ → Entrega → Resumo KPI → Meta Sênior → Funil → Criativos → Problemas → Plano.
- **Fetch extra:** `fetchAdAccountMeta`, `fetchAdsetInsightsRich` (actions, purchase_roas, frequency).

```bash
npm test -- supabase/functions/_shared/diagnosis/derive-paprika-v16.test.ts
npx supabase functions deploy process-diagnosis diagnosis-report --project-ref uvuotaxikuxejfeitlaw
npm run ops:deploy-worker
```

**Reprocessar após v16:** `prompt_version IS DISTINCT FROM 'diagnosis-ecommerce-v16'`.

### QA checklist v16 (Páprika)

1. Bloco 1 abre com gap em R$ (`account_financial_gap`) quando há spend de Vendas.
2. Learning fail nos ad sets de maior gasto — narrativa NÃO diz "saturação" sem `learning_status=active`.
3. Funil checkout &lt;35% gera issue high sobre site (fora do Meta).
4. Winner sub-investido aparece em criativos + actionPlan[0] após reprocessar IA.
5. Campanha awareness (Geo) sem crítica de ROAS/CTR baixo.
6. Cada problema cita ad set/campanha + valor em R$.
7. `consultative_derived.qaChecklist` coerente no `facts_json`.
8. Banner legado some quando `prompt_version = v16`.

## Growth Intelligence v4-consultative (consultor sênior)

- **Prompt:** `diagnosis-growth-intelligence-v4-consultative` — few-shots v13/Páprika + tom consultivo; `build-ai-prompt.ts` slim.
- **IA:** **Sonnet primário**; retry fallback se validação consultiva falhar; tokens reais.
- **Validação:** `validateConsultativeNarrative` — R$ no veredito, 5 capítulos, anti-dashboard, learning_fail ≠ saturação.
- **Fallback:** determinístico só após IA esgotada ou orçamento (`consultative_quality: deferred`).

```bash
npm test -- supabase/functions/_shared/diagnosis/
npx supabase functions deploy process-diagnosis diagnosis-report diagnosis-platform-ops --project-ref uvuotaxikuxejfeitlaw
```

**Secrets Supabase:** `CLAUDE_MODEL=claude-sonnet-4-20250514`, `DIAGNOSIS_AI_MAX_TOKENS=6144`, `DIAGNOSIS_SMALL_ACCOUNT_SPEND_BRL=3000`.

**Reprocessar após v4-consultative:** `prompt_version IS DISTINCT FROM 'diagnosis-growth-intelligence-v4-consultative'`.

### QA checklist v4

1. `buildUserPromptSlim` &lt; 50k chars; sem bloco `facts_json:`.
2. `analysis_json.__meta.narrative_source` = `ai` ou `deterministic`.
3. Orçamento IA estourado → `completed` (não `failed`).
4. Conta pequena: `facts_json.fetch_profile = lite`, sem `trends`.
5. `retry_ai` mantém `facts_json`, regenera só narrativa.
6. Banner discreto na UI quando `narrative_source=deterministic`.
7. `npm test -- supabase/functions/_shared/diagnosis/build-deterministic-analysis.test.ts`.

Query pós-deploy:

```sql
SELECT analysis_json->'__meta'->>'narrative_source' AS source, COUNT(*)
FROM diagnosis_reports r
JOIN diagnoses d ON d.id = r.diagnosis_id
WHERE d.completed_at > now() - interval '7 days'
GROUP BY 1;
```

## Growth Intelligence v3 Enterprise

- **Prompt:** `diagnosis-growth-intelligence-v3` — regras em `v3-growth-intelligence-rules.ts`; doc em `diagnostico-meta/prompts/diagnosis-growth-intelligence-v3.md`.
- **facts_json:** `growth_intelligence_derived` (8 motores) + `consultative_derived` (Páprika).
- **analysis_json:** `growthIntelligenceDerived`, `executiveConclusion`.
- **UI:** 10 seções na apresentação (veredito → na mesa → crescimento → gargalos → riscos → benchmark → maturidade 0–100 → plano → potencial → conclusão).

```bash
npm test -- supabase/functions/_shared/diagnosis/derive-growth-intelligence.test.ts
npx supabase functions deploy process-diagnosis diagnosis-report --project-ref uvuotaxikuxejfeitlaw
```

**Reprocessar após v3:** `prompt_version IS DISTINCT FROM 'diagnosis-growth-intelligence-v3'`.

**Deploy Worker:** requer `CLOUDFLARE_API_TOKEN` no `.env` → `npm run ops:deploy-worker`.

**Reprocess local:** `SUPABASE_SERVICE_ROLE_KEY` no `.env` → `npm run ops:fetch-cron-secret` (colar `CRON_SECRET=...`) → enfileirar `status=processing` → `npm run ops:reprocess-diagnosis`.

**Piloto:** `7e8e3d16-306f-4960-ace3-56de6a3f0b6a` — validado 2026-06-02: `prompt_version=v3`, `growth_intelligence_derived` em `facts_json`; `diagnosis-report` hidrata `growthIntelligenceDerived` + `executiveConclusion` mesmo com `status=failed` (IA: timeout Anthropic / quota OpenAI). Reenfileirar após corrigir chaves para `completed` e narrativa v3 completa.

### QA checklist v3

1. `facts_json.growth_intelligence_derived` presente após fetch (antes da IA).
2. `diagnosis-report`: `growthIntelligenceDerived` e `executiveConclusion` na resposta.
3. UI: 10 âncoras na apresentação (veredito → conclusão).
4. Maturidade exibe score 0–100 (não só nível 1–5).
5. Benchmark com impacto R$ estimado quando há gap.
6. `npm test -- supabase/functions/_shared/diagnosis/` — 45 testes.
7. Banner legado some quando `prompt_version = diagnosis-growth-intelligence-v3`.

## Analista v13 (relator → consultor)

- **Prompt:** `diagnosis-ecommerce-v13` — `hypothesis_seeds`, `business_context`, `business_hints`, few-shots consultivos; `chapterNarratives` obrigatório (5 capítulos).
- **Servidor:** `derive-hypothesis-seeds.ts`, `derive-action-priority.ts`, `derive-business-hints.ts`; `facts.hypothesis_seeds`; `analysis_json.prioritizedActions` + `mondayActions`.
- **Contexto loja:** coluna `diagnoses.business_context`; merge em `process-diagnosis`; formulário no relatório (`DiagnosisBusinessContextForm` → `diagnosis-context`).
- **UI:** bloco **Segunda-feira** (`DiagnosisPriorityPlan`); issues com hipótese colapsável; banner legado se `prompt_version != v13`.
- **Feedback 30d (esboço):** migration `20260602153000_diagnosis_followup.sql`; snapshot + job ao `completed`; cron `diagnosis-followup-daily` (re-agendar: `SELECT public.setup_retentio_cron_jobs('<CRON_SECRET>');`).

```bash
npm test -- supabase/functions/_shared/diagnosis/
npx supabase db push   # ou aplicar migration followup
npx supabase functions deploy process-diagnosis diagnosis-report diagnosis-context diagnosis-followup --project-ref uvuotaxikuxejfeitlaw
npm run ops:deploy-worker
```

**Reprocessar após v13:** `prompt_version IS DISTINCT FROM 'diagnosis-ecommerce-v13'`.

### QA checklist v13

1. Relatório com ≥1 issue: `hypothesisId`, `evidenceFor`/`evidenceAgainst`, `conclusion`, `confidence`.
2. Top 3 ações `urgency=now` com `impactBrl` quando leak disponível.
3. Margem no formulário → após reprocessar, `impactNote` no capítulo financeiro (breakeven).
4. Conta funil misto: sem issue de overlap genérico entre Geo/Meio/Conversão.
5. Ao concluir: linhas em `diagnosis_metric_snapshots` e `diagnosis_followup_jobs` (due +30d).
6. `npm test -- supabase/functions/_shared/diagnosis/` — ≥35 testes.

## Fase 2 — Ad sets (implementado)

- **Fetch:** `adsets_insights` em `process-diagnosis` (`fetchAdSetInsights`, level=adset).
- **Targeting:** `adsets_targeting_sample` (top 5 campanhas) + `derive-adset-targeting.ts` (custom_audience duplicado na mesma campanha).
- **Criativo:** `outbound_clicks`, `outbound_clicks_ctr`, `video_3_sec_watched_actions` no fetch de ads + `derive-ad-metrics.ts`.
- **Públicos:** `derive-adset-audience.ts` — overlap só na mesma campanha (reach rate + freq); `audience.dataAvailable: full` quando há sinais.
- **Estrutura:** campanhas de Vendas paralelas com gasto similar + contagem de ad sets.

### Calibração de maturidade (Fase 3)

Pesos exportados em `MATURITY_WEIGHTS` (`derive-maturity.ts`): tracking 25%, funnel 15%, creative 20%, health 25%, structure 15%. Para recalibrar: comparar `level` vs. avaliação humana em 10–20 contas, ajustar pesos e reprocessar piloto.

## Deploy Worker (front v12)

```bash
npx wrangler login
npm run ops:deploy-worker
```

Sem deploy do Worker, produção pode servir bundle antigo mesmo com Supabase em v12.

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
