# Estado do produto (feature-complete sem gateway de pagamento)

## Implementado neste âmbito

**Auth & estrutura:** login, signup, recuperação de palavra-passe, rotas autenticadas, multi-tenant com RLS, onboarding.

**Integrações:** OAuth via Edge Function `integration-oauth` (Meta, Google Ads/GA4, TikTok), tokens em `integrations` com refresh onde a API devolve; UI em `/integrations` com reconexão, token manual, **janela de sync** (`sync_days`) e **granularidade Meta** (`meta_granularity`). `sync-platform` usa GAQL / relatórios / Marketing API com intervalos configuráveis.

**Operação:** README com checklist `CRON_SECRET`, `pg_cron`, `PORTAL_ALLOWED_ORIGINS`; `portal-data` com allowlist CORS; migrations para remover crons hardcoded e modelo SQL em `cron-jobs.example.sql` / `cron-jobs.deploy-trafego.sql`.

**Limites:** trigger em `alerts` para `max_alerts` por agência (fallback 100); `evaluate-alerts` trata limite na criação em batch.

**Telas:** dashboard; clientes; detalhe de cliente com aba **Insights IA** (último relatório + leitura rápida de health); relatórios com filtros por datas de criação e **período do relatório**, busca no resumo e ordenação; alertas com **agrupamento por cliente** (accordion); palette com relatórios recentes e navegação; skeletons compact/split conforme o tipo de página.

**Qualidade:** Vitest em `format` e `subscription-limits`; CI no GitHub Actions.

## Fora de âmbito (decisão atual)

- Gateway de pagamento (Stripe/checkout/webhooks) e cobrança automática.

## Manutenção recomendada

- Aplicar jobs `pg_cron` no projeto real com secrets próprios.
- Rever **Supabase Advisors** após mudanças de RLS/policies.
- Validar chamadas TikTok/Google contra a documentação atual das APIs (mudam com frequência).
