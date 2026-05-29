# Secrets GitHub — E2E resiliência

Para activar testes de API em [`.github/workflows/e2e-smoke.yml`](../.github/workflows/e2e-smoke.yml):

| Secret | Uso |
|--------|-----|
| `E2E_RESILIENCE` | `1` para correr testes `--grep "API"` |
| `VITE_SUPABASE_URL` | Base URL do projeto |
| `E2E_TEST_ACCESS_TOKEN` | JWT de utilizador de teste (staging) |
| `E2E_TEST_CLIENT_ID` | UUID de cliente com sync permitido |

Opcional Lighthouse: `LIGHTHOUSE_BASE_URL`, `PERF_TEST_EMAIL`, `PERF_TEST_PASSWORD` (workflow `pagespeed.yml`).

Opcional db-lint estrito: `SUPABASE_ACCESS_TOKEN` + projeto ligado no workflow.

Funil Diagnóstico Meta: [`github-secrets-e2e-diagnosis.md`](github-secrets-e2e-diagnosis.md).
