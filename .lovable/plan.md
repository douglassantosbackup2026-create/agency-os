# Auditoria de segurança — achados e correções

Escopo: front-end TanStack Start + Supabase (RLS) + Edge Functions Deno. Não há `createServerFn`/server routes próprios — toda mutação passa por `supabase-js` (PostgREST) ou Edge Functions.

---

## 1) SQL Injection — ✅ Baixo risco

- Todas as leituras/escritas vão por `supabase.from(...).select/insert/update` ou `supabase.rpc("platform_overview_counts" | "platform_list_agencies_minimal")`. PostgREST sempre parametriza; RPCs chamam funções `SECURITY DEFINER` com `search_path = public` definido (visto em `<db-functions>`).
- Nenhum `raw(`, `exec_sql`, ou template-string SQL no código.
- Edge Functions usam `sb.from(...).eq(rawId)` com `rawId` validado por regex UUID antes do `.eq()` (ex.: `DIAGNOSIS_ID_RE` em `mercadopago-webhook`).

**Ações:** nenhuma obrigatória. Manter o padrão "validar com Zod antes do `.eq()`" em qualquer nova Edge Function.

---

## 2) XSS — ⚠ Risco baixo, 1 ponto a endurecer

Usos de `dangerouslySetInnerHTML` encontrados:

| Arquivo | Conteúdo | Veredito |
|---|---|---|
| `src/routes/__root.tsx:169` | `THEME_INIT_SCRIPT` (string literal estática) | ✅ seguro |
| `src/routes/index.tsx:48` | `JSON.stringify(diagnosisFaqJsonLd())` | ✅ seguro (JSON.stringify escapa `<`/`>`/`&` o suficiente para `<script type="application/ld+json">`, mas ver correção abaixo) |
| `src/routes/retentio.tsx:183` | idem | ✅ idem |
| `src/components/ui/chart.tsx:79` | CSS gerado a partir de config de tipos próprios (não user input) | ✅ seguro |

**Correção recomendada (defesa em profundidade nos JSON-LD):** se um dia o FAQ vier de input dinâmico, `JSON.stringify` sozinho não impede `</script>` em strings. Padrão seguro:

```ts
const safeJsonLd = JSON.stringify(data).replace(/</g, "\\u003c");
```

Aplicar em `index.tsx:48` e `retentio.tsx:183`.

**Outras superfícies:** confirmar que nenhum render de `description`/`title` de campanha (Meta API) é usado com `dangerouslySetInnerHTML` no futuro — hoje tudo é interpolação JSX, que React já escapa.

---

## 3) CSRF — ⚠ Atenção em webhooks

- App SPA + Supabase: tokens JWT vão por `Authorization: Bearer` (não cookie de sessão), então **CSRF clássico não se aplica** ao app autenticado.
- **Edge Functions** com efeito colateral expostas publicamente:
  - `mercadopago-webhook`: **NÃO verifica assinatura `x-signature`** do Mercado Pago. Re-busca o pagamento via API antes de marcar como pago — isso impede falsificação direta, mas qualquer um pode disparar carga de chamadas ao MP a partir do seu endpoint. **Correção:** validar header `x-signature` + `x-request-id` (HMAC SHA256 com `MERCADOPAGO_WEBHOOK_SECRET`) com `timingSafeEqual`.
  - `meta-oauth-callback`: ✅ usa `verifyOAuthState` (HMAC assinado, secret `OAUTH_STATE_SECRET`/`META_TEST_OAUTH_STATE_SECRET` com mínimo 16 chars). Bom.
  - Endpoints cron (`process-diagnosis`, `evaluate-alerts`, etc.): verificar se usam `cron-auth.ts` com `CRON_SECRET` em **todas** as funções de cron (auditar `_shared/cron-auth.ts` e confirmar uso em cada `Deno.serve`).

---

## 4) Validação de input (front + back)

- **Front:** `zod` está em uso (`react-hook-form` + `@hookform/resolvers/zod` no projeto). Confirmar cobertura nos formulários de onboarding/cliente.
- **Back (Edge Functions):** ❌ **`rg "zod" supabase/functions` não retorna nada.** Validação é feita ad-hoc (`typeof body.type === "string"`, regex UUID). Funciona, mas é frágil e inconsistente.

**Correção:** adicionar `zod` (via `npm:zod` import no Deno) em cada Edge Function que aceita body, com schema explícito de min/max/regex como no template:

```ts
import { z } from "npm:zod@3";
const Body = z.object({
  type: z.string().min(1).max(64),
  data: z.object({ id: z.string().uuid() }),
});
const parsed = Body.safeParse(await req.json());
if (!parsed.success) return jsonResponse({ error: "invalid" }, 400);
```

Prioridade: `mercadopago-webhook`, `process-diagnosis`, `invite-member`, `send-whatsapp`, `meta-api-test`, `portal-data`, `portal-creative-review` (qualquer função que aceite payload do navegador).

---

## 5) Headers de segurança — ❌ Ausentes

- Sem `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` no `__root.tsx` nem em config de plataforma.
- CORS das Edge Functions usa `Access-Control-Allow-Origin: *` — aceitável para webhooks de terceiros, mas **as funções chamadas pelo app deveriam restringir a `PUBLIC_SITE_URL`**.

**Correções:**

**a) Headers no HTML (via `<meta>` no `__root.tsx > <head>`):**
```tsx
<meta httpEquiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://*.supabase.co https://api.mercadopago.com https://graph.facebook.com;
  frame-ancestors 'none';
" />
<meta httpEquiv="X-Content-Type-Options" content="nosniff" />
<meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
```
> `X-Frame-Options` e `HSTS` só funcionam como header HTTP de verdade — não há `<meta>` equivalente. Configurar no projeto Lovable/CDN (publish settings) ou aceitar `frame-ancestors 'none'` do CSP como substituto de XFO.

**b) Edge Functions chamadas pelo app:** trocar `Access-Control-Allow-Origin: *` por allowlist:
```ts
const ALLOWED = [Deno.env.get("PUBLIC_SITE_URL"), "https://opus-retention-os.lovable.app"];
const origin = req.headers.get("origin");
const allow = ALLOWED.includes(origin) ? origin! : ALLOWED[0]!;
```

---

## Resumo priorizado

| # | Achado | Severidade | Esforço |
|---|---|---|---|
| 1 | Webhook MP sem verificação de assinatura HMAC | **Alta** | Baixo |
| 2 | Headers de segurança ausentes (CSP/XCTO/Referrer) | **Alta** | Baixo |
| 3 | Validação Zod ausente nas Edge Functions | Média | Médio |
| 4 | CORS `*` em funções app-only | Média | Baixo |
| 5 | JSON-LD: escapar `<` em `JSON.stringify` (defesa em profundidade) | Baixa | Trivial |
| 6 | Auditar `cron-auth` em todas as funções de cron | Média | Baixo (revisão) |

SQL Injection e CSRF clássico no app autenticado: **sem ação necessária**.

---

## Próximo passo

Posso implementar nesta ordem em build mode: (1)+(2)+(5) num único turno (mudanças pequenas em `__root.tsx`, `mercadopago-webhook/index.ts` e os dois JSON-LD), depois (3)+(4) numa rodada por função. Confirma se quer que eu prossiga com tudo ou só com a parte crítica (1+2).