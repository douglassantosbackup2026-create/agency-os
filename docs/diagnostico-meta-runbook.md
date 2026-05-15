# Runbook — Diagnóstico Meta (produto `diagnostico-meta`)

Este produto vive no mesmo repositório que o Retentio (`agency-os`) e usa o **mesmo projeto Supabase**: migrations em `supabase/migrations/` e funções em `supabase/functions/`.

## Segundo checkout (gestão Meta / Google, R$ 1.997)

- Migração: colunas `management_*` em `public.diagnoses` (`management_status`: `none` \| `awaiting_payment` \| `paid`).
- Função **create-management-checkout** (`verify_jwt = false`): recebe `diagnosis_id`, `secret_slug`, `business_name`, `website`, `instagram`; valida diagnóstico `completed`, elegibilidade de gasto (≥ R$ 5k) e cria preferência MP com `external_reference` `mgmt:{uuid}`.
- **mercadopago-webhook**: se `external_reference` começa por `mgmt:`, actualiza só `management_mp_payment_id`, `management_status`, `management_paid_at`; não altera `mp_payment_id` nem `status` do funil do diagnóstico.
- **diagnosis-status** e **diagnosis-report**: expõem `management_status` e campos associados ao cliente que tem `d` + `s`.
- Páginas: `/diagnostico/$id` (form + pagamento), `/gestao-obrigado?d=&s=` (poll + WhatsApp).

## Secrets (Supabase Edge Functions)

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Automático no Supabase |
| `PUBLIC_SITE_URL` ou `SITE_URL` | Redirects OAuth e MP `back_urls` (URL pública da app **diagnostico-meta**, ex. `http://localhost:5180`) |
| `MERCADOPAGO_ACCESS_TOKEN` | Preferences + verificação de pagamentos |
| `DIAGNOSIS_PRICE_CENTS` | Opcional (default 3700) |
| `MANAGEMENT_PRICE_CENTS` | Opcional para **create-management-checkout** (default **199700**) |
| `MANAGEMENT_MP_ITEM_TITLE` | Opcional — título do item na preferência Mercado Pago da gestão |
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

O cliente deve guardar o URL `/obrigado?d=UUID&s=SECRET` na app **diagnostico-meta**. Após comprar **gestão** (R$ 1.997), o sucesso do Mercado Pago redirecciona para `/gestao-obrigado?d=…&s=…` (link equivalente ao copiado no browser).

## Suporte

- `failed_reason` na tabela `diagnoses`.
- Logs no Dashboard das Edge Functions.
