## Plano: Fallback hardcoded no `client.ts`

Adicionar valores públicos do Supabase como fallback no `src/integrations/supabase/client.ts`, para o app nunca quebrar quando o `.env` desaparecer do sandbox.

### Mudança

Em `src/integrations/supabase/client.ts`, dentro de `createSupabaseClient()`:

```ts
const FALLBACK_URL = "https://uvuotaxikuxejfeitlaw.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_PUBLISHABLE_KEY;
```

E remover o `throw new Error(...)` (já não é alcançável). Mantém o `console.warn` se algum dos dois caiu para fallback, para ajudar a diagnosticar `.env` ausente sem quebrar runtime.

### Segurança

- URL do projeto e **anon key** são valores públicos por design (já presentes em `.env.example` e expostos a qualquer cliente compilado). Não são secrets.
- `SUPABASE_SERVICE_ROLE_KEY` **não** entra no client — continua só no servidor.
- RLS continua a ser a barreira real de segurança.

### Escopo

- Edita apenas `src/integrations/supabase/client.ts`.
- Não toca em `client.server.ts`, `auth-middleware.ts`, edge functions, ou `.env`.
