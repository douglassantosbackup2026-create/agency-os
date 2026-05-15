# Diagnóstico Meta Ads (sub-app)

App **Vite** independente na pasta `diagnostico-meta/`: mesmo repositório e **mesmo Supabase** que o Retentio (`supabase/migrations` + `supabase/functions` na raiz).

## Comandos (a partir da raiz do `agency-os`)

| Comando | Descrição |
|---------|-----------|
| `npm run diag:dev` | Dev na porta 5180 |
| `npm run diag:build` | Build de produção |
| `npm run diag:lint` / `diag:test` | Qualidade |

Variáveis: copia `diagnostico-meta/.env.example` para `diagnostico-meta/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL` = URL desta app, ex. `http://localhost:5180`).

Operação e cron: [docs/diagnostico-meta-runbook.md](../docs/diagnostico-meta-runbook.md).

Prompt: `prompts/diagnosis-ecommerce-v1.md`.
