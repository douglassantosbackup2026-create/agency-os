# Checklist de segurança RLS e portal

Use em **staging** antes de promover migrações ou alterações de políticas.

**Secrets e operação pré-lançamento:** ver também [`prelaunch-operator-checklist.md`](prelaunch-operator-checklist.md) (`CRON_SECRET`, `PORTAL_ALLOWED_ORIGINS`, smoke manual).

## 1. Migração crítica aplicada

Confirme que a migração `20260517140000_fix_rls_critical_policies.sql` foi aplicada (`npx supabase db push` ou histórico no Dashboard).

Consulta (SQL Editor, role com permissão):

```sql
SELECT policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'clients'
  AND policyname = 'clients_public_portal';
```

**Esperado:** zero linhas.

## 2. `user_roles`: INSERT via cliente não deve funcionar

Com sessão JWT de um utilizador **normal** (não service role), tentar inserir membership numa agência à qual não pertence (substituir UUIDs de teste):

```text
// Pseudocódigo supabase-js no browser ou script com anon + JWT
await supabase.from('user_roles').insert({
  user_id: '<auth.uid() do utilizador A>',
  agency_id: '<agency_id de outra equipa B>',
  role: 'member'
});
```

**Esperado:** erro de permissão / violação RLS.

Convites válidos devem passar pela Edge Function `invite-member` (service role).

## 3. Portal público

Após migração `20260609120100_security_portal_slugs.sql`, todos os slugs foram **regenerados** (24 hex chars). Links antigos `/p/{slug}` deixam de funcionar.

- Slugs novos são atribuídos pelo trigger `tr_clients_assign_portal_slug` (não gerar no frontend).
- Rate limit global por IP em `portal-data` (`PORTAL_GLOBAL_IP_LIMIT_MAX`, default 300/min).

## 4. Meta test harness

**Nunca** activar `META_TEST_ENABLED=true` ou rota `/test-meta-oauth` em produção pública. Ver [`security-audit-remediation.md`](security-audit-remediation.md).

## 5. Portal smoke

- Abrir `/p/<slug-invalido>` — mensagem de portal indisponível.
- Slug válido: dados aparecem (função `portal-data`).
- Opcional: confirmar `429` após limite (`PORTAL_RATE_LIMIT_*`) com ferramenta de carga **apenas** em staging.

## 6. Integrações: tokens invisíveis para `member`

Com JWT de utilizador com role **member**:

```javascript
const { data, error } = await supabase.from('integrations').select('api_key_encrypted');
// Esperado: erro RLS ou zero linhas
```

Leituras devem usar a view `integrations_public` (sem colunas de token):

```javascript
const { data } = await supabase.from('integrations_public').select('*');
// Esperado: OK — metadados apenas
```

## 7. Cron / funções privilegiadas

- Com `CRON_SECRET` definido no Dashboard, chamada sem Bearer secreto nem JWT válido deve responder **401**.
- JWT **member** a invocar `evaluate-alerts` ou `compute-health-scores` deve responder **403**.
- Sem `CRON_SECRET` em dev local: definir `ALLOW_INSECURE_CRON_ANON=true` ou configurar o secret (nunca em produção).

## 8. Mercado Pago (diagnóstico)

- Sem `MERCADOPAGO_WEBHOOK_SECRET`, `mercadopago-webhook` deve responder **503** `webhook_not_configured`.
- Webhook com assinatura inválida: **401**.

## 9. RPC anon smoke (automatizado)

Com a chave **anon** (publishable), as RPCs abaixo não devem responder **200**:

```bash
npm run ops:security-rpc-smoke
```

Inclui: `get_retentio_cron_bearer`, `bootstrap_retentio_cron_jobs`, `get_resilience_ops_snapshot`, `get_agency_dashboard_snapshot`, `claim_ai_jobs`, `platform_diagnosis_buyers_list`.

Migração: `20260625120000_security_rpc_execute_lockdown.sql`.

## 10. Auth Dashboard (manual)

Activar **Leaked Password Protection** em Authentication → Providers → Email → Password security ([doc Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## 11. Automatização futura

Integrar estes passos em CI com dois JWTs de teste e falhar o pipeline se qualquer leitura/escrita cross-tenant passar.
