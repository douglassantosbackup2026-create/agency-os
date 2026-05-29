# Runbook operacional — resiliência Retentio

## Variáveis de ambiente (Edge Functions)

| Variável | Default | Função |
|----------|---------|--------|
| `SYNC_COOLDOWN_MINUTES` | 15 | Cooldown entre syncs por cliente |
| `SYNC_MAX_PER_HOUR` | 60 | Cap de syncs por agência/hora |
| `META_INSIGHTS_MAX_PAGES` | 20 | Paginação Meta insights |
| `META_FETCH_MAX_RETRIES` | 3 | Retries Meta 429/5xx |
| `CRON_AGENCY_BATCH_SIZE` | 5 | Fan-out dispatcher por agência |
| `PROCESS_DIAGNOSIS_BATCH_SIZE` | 10 | Diagnósticos por invocação |
| `REPORT_SYNC_MODE` | false | `true` = relatório síncrono (dev) |
| `AI_JOBS_BATCH_SIZE` | 5 | Jobs IA por tick do worker |
| `WHATSAPP_SUMMARY_BATCH_SIZE` | 25 | Clientes por lote WhatsApp |
| `WHATSAPP_EVOLUTION_THROTTLE_MS` | 300 | Pausa entre envios Evolution |

## Onde o sistema quebra primeiro

1. **Crons globais** sem dispatcher — mitigado por `cron-dispatch-agency-jobs`.
2. **Sync paralelo** — mitigado por lock `sync_runs.status=running` + upsert `metrics_daily`.
3. **Burst Realtime** — mitigado por debounce 3s no dashboard/alertas.
4. **IA sem orçamento** — `check_ai_budget` + fila `ai_jobs`.

## Playbook: buraco de métricas após sync

1. Consultar últimos runs:
   ```sql
   SELECT * FROM sync_runs
   WHERE client_id = '<uuid>'
   ORDER BY created_at DESC LIMIT 10;
   ```
2. Se `status=error` após janela delete antiga: re-sync manual (upsert atual não apaga antes de inserir).
3. Locks órfãos `running` > 30 min:
   ```sql
   SELECT public.cleanup_stale_sync_runs();
   ```

## Playbook: fila IA presa

```sql
SELECT status, COUNT(*) FROM ai_jobs GROUP BY status;
SELECT * FROM ai_jobs WHERE status = 'pending' ORDER BY created_at LIMIT 20;
```

Verificar cron `cron-dispatch-ai-jobs` e logs de `process-ai-jobs`.

## Alertas manuais sugeridos

- `sync_runs` com `status=error` > 10/h por agência
- `ai_jobs` `pending` > 100
- `check_ai_budget` retornando true para agências pagantes (investigar spike em `ai_usage_events`)

## Retenção

Cron semanal recomendado:

```sql
SELECT public.retention_cleanup_ops();
```

Remove `sync_runs` > 90d e `ai_usage_events` > 180d; limpa locks `running` stale.

## Deploy

1. `supabase db push`
2. Deploy functions: `sync-platform`, `generate-report`, `process-ai-jobs`, `cron-dispatch-agency-jobs`, `evaluate-alerts`, `compute-health-scores`, crons dependentes
3. **Crons (obrigatório em produção):**
   - Executar [`supabase/cron-jobs.unschedule-legacy.sql`](../supabase/cron-jobs.unschedule-legacy.sql) no SQL Editor (remove jobs globais antigos).
   - Executar [`supabase/cron-jobs.deploy-trafego.sql`](../supabase/cron-jobs.deploy-trafego.sql) (substituir `__CRON_SECRET_HERE__` pelo `CRON_SECRET` das Edge Functions).
4. Confirmar jobs activos: `SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'cron-dispatch%' OR jobname LIKE 'refresh-client%';`
5. Opcional diagnóstico: definir `DIAGNOSIS_AI_AGENCY_ID` (UUID de agência “sistema”) para contabilizar tokens de `process-diagnosis` em `ai_usage_events`.

## MV `client_metrics_28d`

- Refresh **global** (concurrent) via cron `refresh-client-metrics-28d-nightly` (03:15 UTC) e não após cada sync.
- `refresh_client_metrics_28d(p_client_id)` ignora o parâmetro até evolução para tabela snap por cliente.
