## Problema
O build de produção não encontra `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` porque o `.env` está no `.gitignore`. Vários arquivos do projeto usam fallbacks hardcoded (já com os valores corretos do Supabase), mas bloqueiam esses fallbacks em `PROD`, o que gera o erro que você reportou.

## Solução
Remover a restrição "somente dev" dos fallbacks para que eles sejam usados em qualquer ambiente quando as variáveis de ambiente não estiverem disponíveis. Como `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são públicos por design (chave anônima + URL do Supabase), não há risco de segurança.

## Passos

1. **Criar módulo compartilhado de config Supabase** (`src/lib/supabase-config.ts`)
   - Exportar as constantes de fallback (URL e publishable key)
   - Exportar uma função `resolveSupabaseConfig()` que retorna `{ url, key }`
   - A função deve usar `import.meta.env.*` quando disponível, senão os fallbacks — sem distinção de ambiente

2. **Refatorar `src/integrations/supabase/client.ts`**
   - Substituir a lógica interna por import do módulo compartilhado
   - Remover os fallbacks duplicados inline

3. **Refatorar `src/lib/diagnosis-invoke.ts`**
   - Substituir `resolveSupabaseConfig()` e fallbacks por import do módulo compartilhado

4. **Refatorar `src/lib/meta-api-test.ts`**
   - Substituir `resolveSupabaseUrl()` e `resolvePublishableKey()` por import do módulo compartilhado

5. **Atualizar `src/routes/p.$portalSlug.tsx`**
   - Substituir `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` diretos pelo módulo compartilhado

6. **Atualizar `src/routes/obrigado.tsx`**
   - Substituir `import.meta.env.VITE_SUPABASE_URL` direto pelo módulo compartilhado

## Resultado esperado
O erro `"VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios em produção"` não ocorre mais. O app usa os fallbacks embutidos (já corretos) sempre que as env vars não estiverem presentes, independentemente do ambiente.
