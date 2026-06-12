
# Plano: pronto para anúncios Meta Ads (10 diagnósticos simultâneos)

Objetivo: garantir que o funil aguenta uma rajada de ~10 diagnósticos concorrentes sem 429 da Anthropic, sem timeout de Meta Graph, e com observabilidade mínima para a primeira hora de tráfego.

## 1. Ajuste de capacidade do worker IA (mudança principal)

Hoje: `PROCESS_DIAGNOSIS_BATCH_SIZE=10` + cron `process-diagnosis-batch` a cada 5 min.
Problema: 10 diagnósticos pagos juntos viram 10 chamadas Claude no mesmo tick → 429 quase certo.

Mudar para:
- `PROCESS_DIAGNOSIS_BATCH_SIZE=4` (Supabase Edge Functions secrets)
- `DIAGNOSIS_AI_MAX_TOKENS=6000` (folga em TPM)
- Cron `process-diagnosis-batch`: de `*/5 * * * *` → `*/1 * * * *` (atualizar em `supabase/cron-jobs.deploy-trafego.sql` + reaplicar via SQL Editor)

Resultado esperado: 10 diagnósticos processados em ~3 min com janela de retry para fallback Gemini.

## 2. Throttle Meta Graph mais conservador

Atualizar secrets das Edge Functions:
- `META_FETCH_DELAY_MS=400` (hoje 300)
- `META_FETCH_MAX_RETRIES=3` (hoje 2)

`MetaGraphCircuitBreaker` já existe — só folga no throttle por conta.

## 3. Checklist de secrets de produção (bloqueante)

Rodar `npm run ops:diagnosis-health` e validar via `diagnosis-env-status`:
- MercadoPago: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_PUBLIC_KEY`
- Meta: `META_APP_ID`, `META_APP_SECRET`, `OAUTH_STATE_SECRET` (≥16)
- Infra: `CRON_SECRET` (≥8), `PUBLIC_SITE_URL` = host do Worker publicado
- IA: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (fallback obrigatório p/ rajada)
- `META_TEST_ENABLED` deve estar ausente ou `false`

Se faltar algum: pedir ao utilizador (via `secrets--add_secret` em build mode).

## 4. App Meta em Live Mode

Verificar em developers.facebook.com:
- App em **Live**, não Development
- Permissões `ads_read` + `business_management` **aprovadas** (não apenas pedidas)
- Redirect URI `https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/meta-oauth-callback` registado

(Ação fora do código — incluir no checklist do utilizador.)

## 5. Webhook Mercado Pago de produção

- Confirmar webhook configurado no painel MP → `https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/mercadopago-webhook`
- HMAC com `MERCADOPAGO_WEBHOOK_SECRET` (fail-closed já implementado)
- 1 compra real com cartão de teste para validar fluxo `awaiting_payment → awaiting_connection`

## 6. Observabilidade para a primeira hora

Adicionar dois recursos leves:

a) **Query rápida de status** documentada em `docs/diagnostico-meta-runbook.md`:
```sql
SELECT status, COUNT(*) FROM diagnoses
WHERE created_at > now() - interval '1 hour'
GROUP BY status;
```

b) **Health snapshot**: garantir que `get_resilience_ops_snapshot()` cobre também `diagnoses` recentes (adicionar contagem por status na função, se ainda não cobre).

## 7. Smoke E2E pré-tráfego

Executar antes de ligar campanhas:
1. `npm run ops:diagnosis-health` — landing + checkout 200
2. 1 fluxo real ponta-a-ponta: `/` → `/checkout` (cartão MP teste) → `/obrigado` → OAuth Meta → relatório em `/diagnostico/$id`
3. Validar Pixel `Purchase` no Events Manager (Test Events)
4. Registar resultado em `docs/diagnostico-smoke-log.md`

## Detalhes técnicos (resumo das mudanças no código/config)

| Arquivo / Local | Mudança |
|---|---|
| Supabase Edge Function Secrets | `PROCESS_DIAGNOSIS_BATCH_SIZE=4`, `DIAGNOSIS_AI_MAX_TOKENS=6000`, `META_FETCH_DELAY_MS=400`, `META_FETCH_MAX_RETRIES=3` |
| `supabase/cron-jobs.deploy-trafego.sql` | `process-diagnosis-batch` schedule `*/5` → `*/1` |
| `docs/diagnostico-meta-runbook.md` | Adicionar bloco "queries de monitoring durante tráfego" |
| `docs/diagnostico-smoke-log.md` | Linha nova após smoke pré-anúncios |

Sem alterações de schema, RLS, ou código de aplicação — todo o trabalho é configuração + ops + 1 smoke.

## Fora de escopo (não fazer agora)

- Migrar prompt para Gemini por padrão
- Aumentar TPM Anthropic via Tier upgrade (depende da conta do utilizador)
- Mudar arquitetura do worker para fila persistente externa (overkill p/ 10 simultâneos)

## Critério de "pronto"

- `ops:diagnosis-health` verde
- Smoke E2E completo + Purchase no Pixel
- Cron a 1 min ativo (`SELECT jobname, schedule FROM cron.job WHERE jobname='process-diagnosis-batch'`)
- Todos os secrets da seção 3 retornam `*_ok: true` em `diagnosis-env-status`
