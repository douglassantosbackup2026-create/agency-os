# Runbook de operação (Agency OS)

Documento único para secrets, limites de IA e troubleshooting em produção.

## Secrets obrigatórias (Supabase Edge Functions)

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — ambiente padrão Supabase.
- IA relatório mensal: `LOVABLE_API_KEY` (gateway) ou equivalente usado por `generate-report`.
- IA auditoria de campanhas: preferir `ANTHROPIC_API_KEY`; alternativa `LOVABLE_API_KEY` com `CAMPAIGN_AUDIT_GATEWAY_MODEL`.
- OAuth integrações: `INTEGRATION_OAUTH_STATE_SECRET` (mín. 16 caracteres), `META_APP_ID`, `GOOGLE_OAUTH_CLIENT_ID`, etc., conforme integrações ativas.

## Variáveis de limite / custo IA

### Auditoria de campanhas (`campaign-ai-audit`)

- `CAMPAIGN_AUDIT_COOLDOWN_MINUTES` — intervalo mínimo entre auditorias por cliente (predefinição: 30).
- `CAMPAIGN_AUDIT_MAX_PER_DAY_PER_CLIENT` — quota diária por cliente (predefinição: 8).
- `CAMPAIGN_AUDIT_MODEL` / `CAMPAIGN_AUDIT_GATEWAY_MODEL` — modelo Anthropic ou gateway.

Resposta **429** com mensagem de cooldown ou limite diário: comportamento esperado; informar o utilizador para esperar ou aumentar limites com cautela.

### Relatórios IA (`generate-report`)

- `GENERATE_REPORT_COOLDOWN_MINUTES` — predefinição 20.
- `GENERATE_REPORT_MAX_PER_DAY_PER_CLIENT` — predefinição 12.

Alinhado ao padrão da auditoria: usa a tabela `reports` para último pedido e contagem do dia (UTC).

## Fluxo de sincronização GA4 / plataformas

1. Utilizador liga integração via `integration-oauth`.
2. `sync-platform` corre por cliente com JWT válido e membership no cliente.
3. Métricas e GA4 alimentam auditoria e relatórios.

Com falhas externas, consultar logs estruturados no dashboard Supabase (funções `sync_platform`, `campaign_ai_audit`, `generate_report`) — campos `evt`, `client_id`, `agency_id`.

## Observabilidade

- Eventos de uso IA: tabela `ai_usage_events` (funções registam tokens estimados).
- Logs recomendados: uma linha JSON por evento com `evt`, `client_id`, `agency_id`, latência ou erro truncado.

## Troubleshooting rápido

| Sintoma | Verificar |
|--------|-----------|
| 429 na auditoria | Cooldown / quota diária; mensagem no body JSON da função. |
| 429 no relatório | `GENERATE_REPORT_*`; contagens em `reports`. |
| 402 gateway IA | Créditos Lovable / billing. |
| Sync sem dados | Integração `connected`; `client_platform_accounts`; logs `sync_platform.start`. |

## Tipos TypeScript da base

Para alinhar o frontend com o projeto ligado:

```bash
node --input-type=module -e "import { execSync } from 'child_process'; import fs from 'fs'; const o = execSync('npx supabase gen types typescript --linked', { encoding: 'utf8', maxBuffer: 20*1024*1024 }); fs.writeFileSync('src/integrations/supabase/types.ts', o.trimStart().replace(/^\uFEFF/, '') + '\n', 'utf8');"
```

Evitar redirecionamento PowerShell cru para ficheiro (risco de UTF-16); usar Node ou `Out-File -Encoding utf8NoBOM` no PowerShell 7+.
