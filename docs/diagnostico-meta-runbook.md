# Runbook — Diagnóstico Meta (produto `diagnostico-meta`)

Este produto vive no mesmo repositório que o Retentio (`agency-os`) e usa o **mesmo projeto Supabase**: migrations em `supabase/migrations/` e funções em `supabase/functions/`.

## Secrets (Supabase Edge Functions)

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Automático no Supabase |
| `PUBLIC_SITE_URL` ou `SITE_URL` | Redirects OAuth e MP `back_urls` (URL pública da app **diagnostico-meta**, ex. `http://localhost:5180`) |
| `MERCADOPAGO_ACCESS_TOKEN` | Preferences + verificação de pagamentos |
| `DIAGNOSIS_PRICE_CENTS` | Opcional (default 3700) |
| `META_APP_ID`, `META_APP_SECRET` | OAuth |
| `OAUTH_STATE_SECRET` | Min. 16 caracteres — assinatura do `state` |
| `CRON_SECRET` | Obrigatório em produção para `process-diagnosis` (alinhado às outras crons do projeto) |
| `ALLOW_INSECURE_CRON_ANON` | Apenas dev local (ver `cron-auth` partilhado) |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Análise Claude |

**Redirect URI na app Meta:**  
`https://<PROJECT_REF>.supabase.co/functions/v1/meta-oauth-callback`

## Cron `process-diagnosis`

Agendar `POST` para `.../functions/v1/process-diagnosis` com `Authorization: Bearer <CRON_SECRET>` e header `apikey: <ANON_KEY>`.

Após OAuth bem-sucedido, se `CRON_SECRET` estiver definido, `meta-oauth-callback` dispara uma invocação extra.

## Fluxo sem e-mail

O cliente deve guardar o URL `/obrigado?d=UUID&s=SECRET` na app **diagnostico-meta**.

## Suporte

- `failed_reason` na tabela `diagnoses`.
- Logs no Dashboard das Edge Functions.
