# Checklist — crons Retentio (produção)

Executar no **SQL Editor** do projeto Supabase (`uvuotaxikuxejfeitlaw`), com o mesmo valor de `CRON_SECRET` configurado nas Edge Functions.

## 1. Desagendar jobs legados

Ficheiro: [`supabase/cron-jobs.unschedule-legacy.sql`](../supabase/cron-jobs.unschedule-legacy.sql)

Remove chamadas globais directas a `evaluate-alerts` / `compute-health-scores` (evita duplicar carga com o dispatcher).

## 2. Agendar jobs novos

Ficheiro: [`supabase/cron-jobs.deploy-trafego.sql`](../supabase/cron-jobs.deploy-trafego.sql)

- Substituir todas as ocorrências de `__CRON_SECRET_HERE__` pelo secret real.
- Inclui: dispatcher health/alerts/IA, WhatsApp, refresh MV noturno, retenção semanal, `process-diagnosis`.

## 3. Validar

```sql
SELECT jobname, schedule, active FROM cron.job
WHERE jobname LIKE 'cron-dispatch%'
   OR jobname LIKE 'refresh-client%'
   OR jobname = 'retention-cleanup-weekly'
ORDER BY jobname;
```

## 4. Secrets Edge

- `CRON_SECRET` — obrigatório para crons e worker
- Não definir `REPORT_SYNC_MODE=true` em produção (relatórios via fila)
- `LOVABLE_API_KEY` — worker / relatórios
- `DIAGNOSIS_AI_AGENCY_ID` — opcional, contagem de tokens do diagnóstico
