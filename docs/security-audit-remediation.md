# Security audit remediation — checklist pós-deploy

Referência das correções aplicadas em jun/2026 após auditoria completa. Validar após cada deploy.

## P0 — Hotfixes Edge (imediato)

- [ ] `diagnosis-followup`: sem auth → **401**; com `CRON_SECRET` → **200**
- [ ] `process-diagnosis`: JWT de member comum → **401**; cron → **200**
- [ ] `/test-meta-oauth/callback`: redirect para `/` em produção sem `VITE_META_TEST_ENABLED`
- [ ] `[functions.confirm-ad-account] verify_jwt = false` em `supabase/config.toml`

## P1 — SQL / portal

- [ ] Migrações `20260609120000_security_rpc_guards.sql` e `20260609120100_security_portal_slugs.sql` aplicadas
- [ ] User A não consegue `get_agency_dashboard_snapshot(agency_B_id)` → `forbidden`
- [ ] User normal não consegue `get_resilience_ops_snapshot()` → `forbidden`
- [ ] Todos `portal_slug` regenerados (links `/p/...` antigos invalidados — comunicar clientes)
- [ ] Novos clientes recebem slug via trigger DB (`generate_portal_slug`)
- [ ] `portal-data`: rate limit global por IP ativo

## P2 — Pagamentos e auth

- [ ] Migração `20260609130000_security_subscriptions_guard.sql` aplicada
- [ ] Webhook MP: assinatura inválida → 401; montante inválido → 400 **sem** consumir idempotency
- [ ] `process-*-payment` e `*-payment-status` com rate limit
- [ ] Cart approved valida `transaction_amount` vs DB
- [ ] Layout autenticado usa `getUser()` (não só `getSession()`)
- [ ] Command palette: seed / health / resumos só owner/admin

## P3 — Hardening

- [ ] Migração `20260609140000_security_client_scope_policies.sql` aplicada
- [ ] Member com scope parcial não vê campanhas/alertas de outros clientes via PostgREST
- [ ] `portal-creative-review`: criativo não-`pending` → **409**
- [ ] `PUBLIC_SITE_URL` configurado em produção (CORS diagnosis + app)
- [ ] Build produção exige `VITE_SUPABASE_*` (`scripts/check-prod-env.mjs`)
- [ ] Antes de deploy Edge Functions: `npm run ops:check-edge-env` (exige `PUBLIC_SITE_URL` ou `APP_ALLOWED_ORIGINS`)

## Smoke commands

```bash
npm run test -- --run
npm run db:lint   # com projeto linkado
npm run db:types  # regenerar types após migrations
npm run ops:check-edge-env
```

## Secrets obrigatórios (produção)

| Secret | Função |
|--------|--------|
| `CRON_SECRET` | Cron diagnosis, alertas, health scores |
| `MERCADOPAGO_WEBHOOK_SECRET` | Webhook fail-closed |
| `PORTAL_REVIEW_TOKEN_SECRET` | Review criativos portal |
| `PUBLIC_SITE_URL` | CORS allowlist |
| `META_TEST_ENABLED` | **Nunca** `true` em prod |

## Rollback

- Edge Functions: redeploy commit anterior via Supabase CLI
- SQL: não reverter slugs regenerados sem plano de comunicação; RPC guards são backward-compatible
