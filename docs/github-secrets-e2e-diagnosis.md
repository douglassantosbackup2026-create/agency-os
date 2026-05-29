# Secrets GitHub — E2E Diagnóstico Meta

Workflow: [`.github/workflows/e2e-smoke.yml`](../.github/workflows/e2e-smoke.yml)

| Secret | Obrigatório | Uso |
|--------|-------------|-----|
| `E2E_BASE_URL` ou `LIGHTHOUSE_BASE_URL` | Recomendado | Worker (`https://tanstack-start-app....workers.dev`) — job **rotas públicas** |
| `E2E_DIAGNOSIS` | Opcional (`1`) | Testes API `create-diagnosis-checkout` / `diagnosis-status` |
| `VITE_SUPABASE_URL` | Com `E2E_DIAGNOSIS=1` | Base das Edge Functions |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Com `E2E_DIAGNOSIS=1` | Header `apikey` |

Contratos (`d`/`s`, poll terminal) correm **sempre** sem secrets.

Opcional pagamento sandbox: credenciais MP de teste no operador (não commitar).

Ver também: [`github-secrets-e2e-resilience.md`](github-secrets-e2e-resilience.md).
