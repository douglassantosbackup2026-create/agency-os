# Cloudflare Worker — variáveis de ambiente

Worker: `tanstack-start-app` ([`wrangler.jsonc`](../wrangler.jsonc)).

## Obrigatórias em produção

Sem estas variáveis, rotas como `/login` falham no SSR com:

`VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios em produção.`

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Bundle client ([`client.ts`](../src/integrations/supabase/client.ts)) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Bundle client (anon / publishable) |
| `SUPABASE_URL` | Server functions + [`requireSupabaseAuth`](../src/integrations/supabase/auth-middleware.ts) |
| `SUPABASE_PUBLISHABLE_KEY` | Loader SSR [`fetchDashboardCore`](../src/lib/dashboard-server.ts) |

Valores: mesmo projeto Supabase que em [`.env.example`](../.env.example) (`https://uvuotaxikuxejfeitlaw.supabase.co`).

## Configurar

### Dashboard Cloudflare

1. Workers & Pages → `tanstack-start-app` → **Settings** → **Variables and Secrets**
2. Adicionar as quatro variáveis (Production + Preview se aplicável)
3. **Redeploy** após alterar (`npm run build && npx wrangler deploy`)

### CLI (secrets sensíveis)

```bash
# Publicáveis podem ir em wrangler.jsonc "vars" ou como secret
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put VITE_SUPABASE_PUBLISHABLE_KEY
```

### wrangler.jsonc (opcional, não commitar chaves reais)

```jsonc
{
  "vars": {
    "VITE_SUPABASE_URL": "https://SEU_PROJETO.supabase.co",
    "SUPABASE_URL": "https://SEU_PROJETO.supabase.co"
  }
}
```

Use **secrets** para chaves JWT; não commitar anon keys em repositório público.

## Verificação pós-deploy

```bash
npm run ops:deploy-worker
npm run ops:resilience-health -- --url https://tanstack-start-app.douglaspinheirosantos94.workers.dev/login
# Esperado: status 200 (não 500)
```

Deploy automatizado lê [`.env`](.env) ou [`.env.example`](.env.example) e passa `--var` ao `wrangler deploy`.
