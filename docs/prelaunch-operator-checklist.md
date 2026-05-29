# Checklist operador — antes do primeiro utilizador real

Execute **staging**, depois **produção**. Não commitar valores de secrets neste documento.

## 1. Secrets das Edge Functions (Dashboard Supabase)

| Secret | Onde confirmar | Notas |
|--------|----------------|--------|
| `CRON_SECRET` | Edge Functions → Secrets | Opcional se usou `bootstrap_retentio_cron_jobs` (bearer em `retentio_ops_config`). Para alinhar env: `SELECT get_retentio_cron_bearer();` no SQL Editor ou `npm run ops:sync-cron-secret` (requer `SUPABASE_ACCESS_TOKEN`). |
| `REPORT_SYNC_MODE` | Opcional | `true` apenas em dev (relatórios síncronos). Produção: omitir (fila `ai_jobs`). |
| `CRON_AGENCY_BATCH_SIZE` | Opcional | Default 5 — fan-out por agência. |
| `CRON_DISPATCH_AGENCIES_LIMIT` | Opcional | Default 50 — cursor round-robin do dispatcher. |
| `CAMPAIGN_AUDIT_SYNC_MODE` | Opcional | `true` apenas em dev (audit síncrono). Produção: omitir (fila `ai_jobs`). |
| `ALLOW_INSECURE_CRON_ANON` | **Não** definir em produção | Só desenvolvimento local. |
| `PORTAL_ALLOWED_ORIGINS` | Secrets compartilhados ou por função | Domínios do frontend que chamam `portal-data` (lista CSV). Evitar `*` em produção. |
| `PORTAL_REVIEW_TOKEN_SECRET` | Edge Functions → Secrets | Mín. 16 caracteres; obrigatório para `portal-creative-review`. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Edge Functions → Secrets | **Obrigatório** — webhook recusa pedidos sem assinatura válida. |
| `META_TEST_ENABLED` | **false** ou ausente em prod | Não expor harness `meta-api-test` em produção. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Automático / Secrets | Service role só server-side. |

## 2. Base de dados

- `npx supabase db push` inclui migrations de resiliência: `20260530120000_sync_resilience.sql`, `20260530130000_resilience_p1_p2.sql`, `20260601120000_resilience_phase2_gaps.sql`, `20260602120000_resilience_phase3_gaps.sql`.
- Runbook resiliência: [`ops-resilience-runbook.md`](ops-resilience-runbook.md).
- Consultas em [`security-rls-checklist.md`](security-rls-checklist.md).

## 2b. Funil Diagnóstico Meta (homepage `/`)

| Item | Confirmar |
|------|-----------|
| `PUBLIC_SITE_URL` / `VITE_PUBLIC_SITE_URL` | Igual ao Worker em produção |
| Secrets MP, Meta, OAuth, Claude, `CRON_SECRET` | Ver [`diagnosis-production-env.md`](diagnosis-production-env.md) |
| `META_TEST_ENABLED` | Ausente ou `false` |
| Cron `process-diagnosis-batch` | Activo (`ops:apply-crons` ou SQL bootstrap) |
| Smoke 15 min | [`diagnostico-smoke-log.md`](diagnostico-smoke-log.md) |
| E2E CI | `e2e/diagnosis-funnel.spec.ts` no workflow `e2e-smoke` |

Runbook: [`diagnostico-meta-runbook.md`](diagnostico-meta-runbook.md).

## 3. Smoke manual — SaaS agência (5 min)

1. Login utilizador membro.
2. Dashboard carrega sem erro vermelho persistente.
3. Lista clientes carrega; criar cliente obedece ao limite do plano (toast se bloqueado).
4. Portal `/p/<slug-teste>` OK ou mensagem amigável se slug inválido.
5. Opcional: invocar uma função cron com header secreto e confirmar **200** (não 401).

## 4. Incidentes e suporte

- Runbook: [`runbook-operacao.md`](runbook-operacao.md).
- Definir canal interno (Slack/email) para falhas reportadas por utilizadores piloto.
