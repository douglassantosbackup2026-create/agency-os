# Validação de performance — resiliência Retentio

Registo manual pós-deploy. Actualizar após cada release relevante.

## Critérios de aceite

| Métrica | Meta | Última medição | Data | Notas |
|---------|------|---------------|------|-------|
| TTFB p95 `/dashboard` (autenticado) | &lt; 800 ms | _registar após deploy_ | | `npm run perf:lighthouse` + `npm run ops:resilience-health` |
| MV `client_metrics_28d` refresh | &lt; 5 min após cron 03:15 UTC | _pendente_ | | Query abaixo |
| Locks `sync_runs` `running` &gt; 30 min | &lt; 0,1% do total 24h | _pendente_ | | Query abaixo |

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

## Histórico

| Data | Deploy | TTFB | MV | Locks | Responsável |
|------|--------|------|-----|-------|-------------|
| 2026-06-03 | Fase 3 (`5dc2f27`) | | | | |
