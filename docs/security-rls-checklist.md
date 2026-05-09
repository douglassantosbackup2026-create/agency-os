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

- Abrir `/p/<slug-invalido>` — mensagem de portal indisponível.
- Slug válido: dados aparecem (função `portal-data`).
- Opcional: confirmar `429` após limite (`PORTAL_RATE_LIMIT_*`) com ferramenta de carga **apenas** em staging.

## 4. Cron / funções privilegiadas

- Com `CRON_SECRET` definido no Dashboard, chamada sem Bearer secreto nem JWT válido deve responder **401**.
- Sem `CRON_SECRET` em dev local: definir `ALLOW_INSECURE_CRON_ANON=true` ou configurar o secret.

## 5. Automatização futura

Integrar estes passos em CI com dois JWTs de teste e falhar o pipeline se qualquer leitura/escrita cross-tenant passar.
