# Runbook de operação (Agency OS)

Documento único para secrets, limites de IA e troubleshooting em produção.

## Secrets obrigatórias (Supabase Edge Functions)

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — ambiente padrão Supabase.
- **`CRON_SECRET`** — obrigatório em produção para funções que usam [`cron-auth`](../supabase/functions/_shared/cron-auth.ts) (`compute-health-scores`, `evaluate-alerts`, `whatsapp-summary`). Sem este valor, **anon apikey deixa de passar** (comportamento seguro). Para desenvolvimento local sem secret, definir **`ALLOW_INSECURE_CRON_ANON=true`** apenas no ambiente local (nunca em produção).
- **`PORTAL_ALLOWED_ORIGINS`** — recomendado definir domínios explícitos para CORS do `portal-data` em produção.
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

### Pauta de reunião (`generate-meeting-report`)

Usa os **mesmos** limites globais que o relatório: `GENERATE_REPORT_COOLDOWN_MINUTES` e `GENERATE_REPORT_MAX_PER_DAY_PER_CLIENT`, aplicados sobre a tabela `meeting_reports` por cliente.

## Fluxo de sincronização GA4 / plataformas

1. Utilizador liga integração via `integration-oauth`.
2. `sync-platform` corre por cliente com JWT válido e membership no cliente.
3. Métricas e GA4 alimentam auditoria e relatórios.

Com falhas externas, consultar logs das Edge Functions no dashboard Supabase: eventos JSON por linha com `evt`, `latency_ms`, identificadores de negócio e `error_trunc` quando aplicável (ex.: `generate_report.ok`, `campaign_ai_audit.ok`, `sync_platform.ok`, `evaluate_alerts.ok`, `compute_health_scores.ok`, `whatsapp_summary.ok`).

## Portal público (`portal-data`)

- O slug é truncado no servidor e validado contra `[a-z0-9_-]+`.
- Opcional: `PORTAL_SLUG_MIN_LENGTH` (predefinição 4) para exigir slugs mais longos em produção.
- **Rate limit (best-effort por isolate):** `PORTAL_RATE_LIMIT_MAX_PER_WINDOW` (predefinição **120** pedidos), `PORTAL_RATE_LIMIT_WINDOW_MS` (predefinição **60000**). Aplica-se a `portal-data` e `portal-creative-review`; não substitui rate limit na CDN/API Gateway.
- **RLS:** a política permissiva `clients_public_portal` foi removida na migração `20260517140000_fix_rls_critical_policies.sql`; dados expostos ao cliente final passam só pela função `portal-data` (service role + dados sanitizados). Após pull do repo, correr `npx supabase db push` no projeto ligado.

## Modelo de dados: `profiles` vs `user_roles`

- **`profiles.agency_id`:** agência “principal” do utilizador após signup (trigger `handle_new_user`).
- **`user_roles`:** papel por `(user_id, agency_id)`; é a fonte usada por `is_member_of` / `is_owner_or_admin`. Novos memberships **não** devem ser inseridos pelo cliente com JWT: usam `invite-member` (service role) ou triggers `SECURITY DEFINER`.
- Manter estes conceitos alinhados ao evitar fluxos que atualizem só uma das tabelas sem a outra.

Checklist manual de verificações: [`security-rls-checklist.md`](security-rls-checklist.md).

## Migrações críticas de segurança (RLS)

- `20260517140000_fix_rls_critical_policies.sql` — remove `clients_public_portal`; bloqueia `INSERT` em `user_roles` e `agencies` para sessões JWT normais (signups e convites continuam via triggers SECURITY DEFINER ou service role).

## Observabilidade

- Eventos de uso IA: tabela `ai_usage_events` (funções registam tokens estimados).
- Logs estruturados: uma linha JSON por pedido relevante (`evt`, `latency_ms`, `agency_id` / `client_id` quando seguro, `error_trunc` em falhas).

## Troubleshooting rápido

| Sintoma | Verificar |
|--------|-----------|
| 429 na auditoria | Cooldown / quota diária; mensagem no body JSON da função. |
| 429 no relatório | `GENERATE_REPORT_*`; contagens em `reports`. |
| 429 na pauta de reunião | Mesmos `GENERATE_REPORT_*`; contagens em `meeting_reports`. |
| 402 gateway IA | Créditos Lovable / billing. |
| Sync sem dados | Integração `connected`; `client_platform_accounts`; logs `sync_platform.start`. |

## Tipos TypeScript da base

Para alinhar o frontend com o projeto ligado:

```bash
node --input-type=module -e "import { execSync } from 'child_process'; import fs from 'fs'; const o = execSync('npx supabase gen types typescript --linked', { encoding: 'utf8', maxBuffer: 20*1024*1024 }); fs.writeFileSync('src/integrations/supabase/types.ts', o.trimStart().replace(/^\uFEFF/, '') + '\n', 'utf8');"
```

Evitar redirecionamento PowerShell cru para ficheiro (risco de UTF-16); usar Node ou `Out-File -Encoding utf8NoBOM` no PowerShell 7+.
