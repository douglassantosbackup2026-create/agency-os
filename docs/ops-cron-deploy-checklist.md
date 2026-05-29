# Checklist — crons Retentio (produção)

Executar no **SQL Editor** do projeto Supabase (`uvuotaxikuxejfeitlaw`), com o mesmo valor de `CRON_SECRET` configurado nas Edge Functions.

## 1. Desagendar jobs legados

Ficheiro: [`supabase/cron-jobs.unschedule-legacy.sql`](../supabase/cron-jobs.unschedule-legacy.sql)

Remove chamadas globais directas a `evaluate-alerts` / `compute-health-scores` (evita duplicar carga com o dispatcher).

## 2. Agendar jobs novos

**Opção A (recomendada):** bootstrap automático (só service role)

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run ops:apply-crons
```

Gera bearer em `retentio_ops_config` e agenda todos os jobs. Edge Functions aceitam `CRON_SECRET` env **ou** bearer da tabela.

**Opção B:** secret explícito

```bash
CRON_SECRET=... SUPABASE_SERVICE_ROLE_KEY=... npm run ops:apply-crons
```

**Opção C:** SQL Editor — [`supabase/cron-jobs.deploy-trafego.sql`](../supabase/cron-jobs.deploy-trafego.sql)

- Substituir todas as ocorrências de `__CRON_SECRET_HERE__` pelo secret real.
- Inclui: dispatcher health/alerts/IA, WhatsApp, refresh MV noturno, retenção semanal, cleanup sync hourly, `process-diagnosis`.

**Opção D:** uma linha no SQL Editor (bootstrap idempotente):

```sql
SELECT public.bootstrap_retentio_cron_jobs();
```

## 3. Validar

```sql
SELECT jobname, schedule, active FROM cron.job
WHERE jobname LIKE 'cron-dispatch%'
   OR jobname LIKE 'refresh-client%'
   OR jobname = 'retention-cleanup-weekly'
ORDER BY jobname;
```

## 4. Secrets Edge

- `CRON_SECRET` — opcional se usar bootstrap (`retentio_ops_config`); recomendado alinhar env com o bearer da tabela
- Não definir `REPORT_SYNC_MODE=true` em produção (relatórios via fila)
- `LOVABLE_API_KEY` — worker / relatórios
- `DIAGNOSIS_AI_AGENCY_ID` — opcional, contagem de tokens do diagnóstico
