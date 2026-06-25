# Validação de performance — resiliência Agency Opus

Registo manual pós-deploy. Actualizar após cada release relevante.

## Critérios de aceite

| Métrica | Meta | Última medição | Data | Notas |
|---------|------|---------------|------|-------|
| TTFB p95 `/dashboard` (autenticado) | &lt; 800 ms | _pendente Lighthouse_ | 2026-05-29 | `/login` público: **404 ms** (health check pós-deploy Worker) |
| MV `client_metrics_28d` refresh | &lt; 5 min após cron 03:15 UTC | null (aguarda 1.º cron pós-migration) | 2026-05-29 | `get_resilience_ops_snapshot()` — gravado em `dispatch_state` após refresh |
| Locks `sync_runs` `running` &gt; 30 min | &lt; 0,1% do total 24h | **0%** (0/0 runs 24h) | 2026-05-29 | `stale_sync_running: 0`, `sync_runs_24h: 0` |

## Comandos

### Lighthouse autenticado

```bash
# Requer .env ou secrets: LIGHTHOUSE_BASE_URL, PERF_TEST_EMAIL, PERF_TEST_PASSWORD
npm run perf:lighthouse
```

Relatórios em `lighthouse-reports/`. CI semanal: [`.github/workflows/pagespeed.yml`](../.github/workflows/pagespeed.yml).

### SQL (Supabase SQL Editor)

```sql
SELECT public.get_resilience_ops_snapshot();
```

Ou consultas individuais em [`ops-resilience-runbook.md`](ops-resilience-runbook.md#validação-de-performance).

### TTFB rápido (curl)

```bash
node scripts/resilience-health-check.mjs --url https://SEU_WORKER.workers.dev/dashboard
```

Requer cookie de sessão para dashboard autenticado; use Lighthouse para medição completa.

## Snapshot 2026-05-29 (produção)

```json
{
  "checked_at": "2026-05-29T19:06:24Z",
  "stale_sync_running": 0,
  "sync_runs_24h": 0,
  "stale_running_pct": 0,
  "ai_jobs_pending": 0,
  "agencies_over_100_clients": [],
  "mv_client_metrics_28d_last_refresh": null
}
```

Worker: `https://tanstack-start-app.douglaspinheirosantos94.workers.dev/login` → HTTP **200**, TTFB ~404 ms.

## Histórico

| Data | Deploy | TTFB | MV | Locks | Responsável |
|------|--------|------|-----|-------|-------------|
| 2026-05-29 | Deploy completo (`0c6625c`) — 30 Edge Functions + Worker | `/login` 430 ms, `/agency-opus` 612 ms | null | 0% | ops |
| 2026-06-03 | Fase 3 (`5dc2f27`) | | | | |
