# Harness Meta Marketing API (`/test-meta-oauth`)

Ambiente **dev-only** para validar OAuth Meta e chamadas à Graph API antes de produção. Não grava tokens na base de dados — usa `localStorage` no browser.

## Pré-requisitos

- Node.js 22+, `npm run dev` na raiz do `agency-os`
- App Meta em [developers.facebook.com](https://developers.facebook.com) com:
  - **Valid OAuth Redirect URI:** `https://uvuotaxikuxejfeitlaw.supabase.co/functions/v1/meta-oauth-callback`
  - Permissões: `ads_read`, `ads_management`, `business_management`
- Secrets no **Supabase Dashboard → Edge Functions → Secrets**

| Secret | Valor |
|--------|--------|
| `META_APP_ID` | ID da app Meta |
| `META_APP_SECRET` | Secret da app Meta |
| `META_TEST_ENABLED` | `true` |
| `META_TEST_OAUTH_STATE_SECRET` | String aleatória ≥ 16 caracteres |
| `META_API_VERSION` | Opcional; default `v21.0` |
| `PUBLIC_SITE_URL` | Só origem: `http://localhost:8080` (sem `/test-meta-oauth`) |

Alternativa: preencher o formulário **Secrets do harness** na própria página `/test-meta-oauth` (valores em `localStorage` + enviados como `dev_config` à Edge Function, sem deploy de secrets).

## Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

## Deploy da Edge Function

```bash
npx supabase functions deploy meta-api-test --project-ref uvuotaxikuxejfeitlaw
npx supabase functions deploy meta-oauth-callback --project-ref uvuotaxikuxejfeitlaw
```

Para testar localmente contra functions servidas:

```bash
npx supabase functions serve
```

## Smoke test (5 min)

1. Abrir `http://localhost:5173/test-meta-oauth`
2. Preencher **Secrets do harness** (formulário no topo) e clicar **Salvar secrets**
3. Registar na Meta a redirect URI Supabase (mostrada no formulário)
4. Clicar **Conectar Meta Ads** → autorizar na Meta
5. Verificar token truncado e lista de **Ad Accounts**
6. Seleccionar uma conta → **Buscar Campanhas** e **Buscar Insights (90 dias)**
7. Seleccionar campanha → **Buscar AdSets** → seleccionar ad set → **Buscar Ads**
8. Confirmar JSON na área de resultados
9. **Limpar tudo e reconectar** remove `localStorage`

## Segurança

- A rota `/test-meta-oauth` redirecciona para `/` fora de `import.meta.env.DEV` (build de produção).
- A Edge Function recusa pedidos se `META_TEST_ENABLED !== "true"`.
- OAuth usa callback Supabase `meta-oauth-callback` (mesma URI do funil diagnóstico).
- `PUBLIC_SITE_URL` define para onde o Supabase redirecciona após trocar o token (`/test-meta-oauth/callback`).
- **Nunca** activar `META_TEST_ENABLED` em produção pública sem necessidade.

## Ficheiros

| Ficheiro | Papel |
|----------|--------|
| `src/routes/test-meta-oauth.tsx` | UI do harness |
| `src/routes/test-meta-oauth.callback.tsx` | Callback OAuth SPA |
| `src/lib/meta-api-test.ts` | Client → Edge Function |
| `src/types/meta.ts` | Types TypeScript |
| `supabase/functions/meta-api-test/index.ts` | OAuth + proxy Graph API |
| `supabase/functions/_shared/meta-graph-api.ts` | Helpers Graph API |

## Troubleshooting

| Erro | Causa provável |
|------|----------------|
| Harness desactivado | `META_TEST_ENABLED` não é `true` |
| redirect_uri inválido | URI na Meta deve ser `{SUPABASE_URL}/functions/v1/meta-oauth-callback` |
| state inválido / expirado | Repetir OAuth; state expira em 15 min |
| 404 em `/test-meta-oauth/test-meta-oauth` | `PUBLIC_SITE_URL` tinha path; corrigir para só origem e Salvar secrets |
| `oauth_error` redirect_uri 36008 | URI na Meta = callback Supabase; `META_APP_ID`/`SECRET` iguais no form e Supabase |
| Meta API 190 | Token revogado ou expirado — reconectar |
| CORS / 403 na function | Verificar deploy de `meta-api-test` e `apikey` no `.env` |
