# Auditoria SSR / Cloudflare — Retentio

Escopo P2.5 do plano de resiliência. Estado auditado em maio/2026.

## Stack

| Camada | Tecnologia |
|--------|------------|
| SSR | TanStack Start via `@lovable.dev/vite-tanstack-config` |
| Runtime | Cloudflare Workers (`wrangler.jsonc`, deploy `tanstack-start-app`) |
| Entry SSR | [`src/server.ts`](../src/server.ts) — wrapper de erros sobre `@tanstack/react-start/server-entry` |

## Findings

### TTFB e cold start

- Worker startup reportado ~14–20 ms no último deploy (baixo).
- Rotas autenticadas dependem de Supabase client-side após hidratação; loaders SSR leves reduzem TTFB vs SPA pura.

### Cache público

| Rota | Recomendação |
|------|----------------|
| `/login`, `/signup` | `Cache-Control: public, max-age=0, must-revalidate` (default worker) |
| `/retentio`, landing | Avaliar `s-maxage=3600` em assets estáticos via Cloudflare CDN |
| `/_authenticated/*` | **Sem cache público** — dados por agência |

**Acção futura:** headers em `src/server.ts` ou middleware TanStack por rota pública.

### Loaders TanStack Start

- Dashboard e alertas carregam via React Query no cliente (não bloqueiam SSR com 10+ queries).
- **Risco:** HTML inicial sem dados operacionais — aceitável com skeleton; evita fan-out SSR.

### Erros SSR

- [`src/server.ts`](../src/server.ts) captura erros catastróficos JSON do Start e devolve página HTML branded (500).
- [`src/lib/error-capture.ts`](../src/lib/error-capture.ts) integrado no entry.

### Observabilidade

- Cloudflare Workers Analytics + logs `wrangler tail`.
- Edge Functions Supabase separadas (não passam pelo Worker).

## Checklist operacional

1. `npm run build && npx wrangler deploy` após alterações de rota.
2. Lighthouse autenticado: `npm run perf:lighthouse` (script existente).
3. Validar TTFB p95 < 800 ms em `/dashboard` (com sessão) via Cloudflare Speed / WebPageTest.
4. Confirmar que rotas API sensíveis não são cacheadas no dashboard Cloudflare.

## Melhorias sugeridas (backlog)

- Loader server-side único para KPIs do dashboard (`get_agency_dashboard_snapshot`) em rota `/dashboard` only.
- `staleTimes` TanStack Router alinhados com debounce Realtime (3s).
- Page Rules / Cache Rules Cloudflare para `/assets/*` long-lived.
