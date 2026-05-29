# Performance — funil Diagnóstico Meta (público)

Meta interna: **TTFB &lt; 800 ms** em `/`, `/checkout`, `/obrigado` (HTML inicial).

## Medição

```bash
npm run ops:diagnosis-health
# LIGHTHOUSE_BASE_URL=https://...workers.dev npm run ops:diagnosis-health
```

Lighthouse (opcional, sem login):

```bash
LIGHTHOUSE_BASE_URL=https://tanstack-start-app.douglaspinheirosantos94.workers.dev npm run perf:lighthouse
```

Paths relevantes: `/`, `/checkout` (não requer `PERF_TEST_*`).

## Registo 2026-05-29

| Rota | Status | TTFB (ms) | Notas |
|------|--------|-----------|-------|
| `/` | 200 | 450 | Worker produção — abaixo de 800 ms |
| `/checkout` | 200 | 94 | |
| `/obrigado` | 200 | 30 | query smoke UUID |

Actualizar após cada deploy Worker relevante.
