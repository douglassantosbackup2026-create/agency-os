# Agency Opus (agency-os)

Plataforma operacional para agências de tráfego: health score, alertas, relatórios com IA, portal do cliente e integrações.

Código-fonte: [douglassantosbackup2026-create/agency-os](https://github.com/douglassantosbackup2026-create/agency-os) (`origin`).

```bash
git remote add origin https://github.com/douglassantosbackup2026-create/agency-os.git   # só se ainda não existir
git remote -v                                                                            # deve mostrar esse URL como origin
```

Se `git push` devolver **403**, o Git está a usar uma conta sem permissão de escrita: corre `gh auth login` (repo [agency-os](https://github.com/douglassantosbackup2026-create/agency-os)) ou remove credenciais antigas do Gestor de credenciais do Windows para `github.com` e volta a autenticar com a conta dona/colaboradora.

## Requisitos

- Node.js >= 22.19 (exigido pelo script `perf:lighthouse`; para dev/build basta Node 22 compatível com o teu ambiente)
- Conta [Supabase](https://supabase.com) (projeto com migrations e Edge Functions deste repositório)

## Variáveis de ambiente

Crie `.env` na raiz (ou configure no host de deploy):

| Variável                        | Descrição                                  |
| ------------------------------- | ------------------------------------------ |
| `VITE_SUPABASE_URL`             | URL do projeto (ex.: `https://uvuotaxikuxejfeitlaw.supabase.co` para o ambiente Trafego) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (anon / publishable)      |

Modelo: copie [`.env.example`](.env.example) para `.env` e preencha as chaves (o ficheiro `.env` não deve ser commitado).

### Cloudflare Worker (produção)

Além das variáveis `VITE_*` no build, configure no Worker [`tanstack-start-app`](docs/cloudflare-worker-env.md): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Sem isto, `/login` e o loader SSR do dashboard falham com 500.

## Comandos

```bash
npm ci
npm run dev          # desenvolvimento
npm run lint
npm run test         # testes unitários (Vitest)
npm run db:lint      # PostgreSQL advisors via Supabase CLI (projeto ligado)
npm run build        # build de produção (requer env acima)
npm run ops:resilience-health -- --url https://SEU_WORKER.workers.dev/login
npm run perf:lighthouse   # TTFB/LCP autenticados (ver docs/ops-performance-validation.md)
```

## Produto Diagnóstico Meta

**Homepage (`/`)** = landing do diagnóstico; **landing Agency Opus** em [`/agency-opus`](src/routes/agency-opus.tsx) (redirect legado: `/retentio`). Rotas: `/obrigado`, `/diagnostico/$id?s=`. Sub-app legado em `diagnostico-meta/` (`npm run diag:dev`) — preferir o app principal. Runbook: [`docs/diagnostico-meta-runbook.md`](docs/diagnostico-meta-runbook.md).

## Supabase local

```bash
npx supabase link --project-ref <ref>
npx supabase db push    # migrations (inclui correções RLS críticas)
npx supabase functions serve   # opcional: testar functions localmente
```

Para invocar funções cron localmente **sem** definir `CRON_SECRET`, configure no ambiente das Edge Functions `ALLOW_INSECURE_CRON_ANON=true` (só local).

### Secrets das Edge Functions

Configure no Dashboard do Supabase (**Edge Functions → Secrets**):

| Secret                                    | Uso                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CRON_SECRET`                             | **Obrigatório em produção.** Cron: `Authorization: Bearer <CRON_SECRET>` ou `x-cron-secret`. Owner/admin podem invocar funções cron pesadas com JWT; members recebem 403. Sem este secret, pedidos são **recusados**, salvo `ALLOW_INSECURE_CRON_ANON=true` (apenas dev local). |
| `ALLOW_INSECURE_CRON_ANON`               | Se `true` e `CRON_SECRET` vazio, aceita chamadas só com `apikey` anon — **proibido em produção**. |
| `MERCADOPAGO_WEBHOOK_SECRET`             | **Obrigatório em produção** para `mercadopago-webhook` (fail-closed sem assinatura). |
| `PORTAL_REVIEW_TOKEN_SECRET`             | Mín. 16 chars; token HMAC para `portal-creative-review`. |
| `META_TEST_ENABLED`                      | `false` ou ausente em produção; nunca activar harness `meta-api-test` em ambiente público. |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` | WhatsApp via Evolution API (opcional).                                                                                                                                                                                                                                                                 |
| `PORTAL_ALLOWED_ORIGINS`                  | Lista separada por vírgula para CORS no `portal-data`; se vazio, cai em `*` (endurecer em produção com o domínio do portal).                                                                                              |
| `PORTAL_RATE_LIMIT_MAX_PER_WINDOW`       | Opcional: máximo de pedidos por janela por IP+slug nas funções `portal-data` e `portal-creative-review` (predefinição **120**).                                                                             |
| `PORTAL_RATE_LIMIT_WINDOW_MS`             | Opcional: duração da janela em ms (predefinição **60000**). Para picos elevados, use também CDN/API Gateway.                                                                                               |

Opcional no runtime **`portal-data`**: `PORTAL_SLUG_MIN_LENGTH` (predefinição **4**) — comprimento mínimo do `slug` na query; caracteres permitidos: letras, dígitos, `_` e `-`.

Secrets adicionais da função **`integration-oauth`** (OAuth browser para Meta / Google / TikTok / GA4):

| Secret | Descrição |
| ------ | --------- |
| `INTEGRATION_OAUTH_STATE_SECRET` | Segredo HMAC para assinar o `state` do OAuth (mínimo 16 caracteres). |
| `META_APP_ID` / `META_APP_SECRET` | App Meta para fluxo Marketing API (`ads_read`). |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Google (escopos `adwords` e `analytics.readonly`). |
| `TIKTOK_CLIENT_KEY` ou `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET` ou `TIKTOK_CLIENT_SECRET` | TikTok Marketing API OAuth. |
| `PUBLIC_SITE_URL` ou `SITE_URL` | URL do frontend sem barra final; redirect válido → `{SITE}/integrations/oauth/callback`. |

Para métricas **Google Ads** via `sync-platform`, mantém-se **`GOOGLE_ADS_DEVELOPER_TOKEN`** (e opcional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` para contas MCC).

Depois de alterar secrets ou políticas sensíveis, execute uma passagem pelos **Supabase Advisors** (Dashboard ou MCP) para rever performance e segurança.

**Antes do primeiro utilizador real:** checklist operacional em [`docs/prelaunch-operator-checklist.md`](docs/prelaunch-operator-checklist.md) e auditoria RLS em [`docs/security-rls-checklist.md`](docs/security-rls-checklist.md).

**Pagamentos (futuro):** desenho técnico Mercado Pago em [`docs/MERCADO_PAGO_INTEGRATION.md`](docs/MERCADO_PAGO_INTEGRATION.md).

### Crons (`pg_cron` + `pg_net`)

A migration `20260508160000_unschedule_hardcoded_cron_jobs.sql` remove jobs que continham URL/chave fixas do repositório. Há um modelo com placeholders em [`supabase/cron-jobs.example.sql`](supabase/cron-jobs.example.sql) e, para o projeto Trafego já com ref na URL, [`supabase/cron-jobs.deploy-trafego.sql`](supabase/cron-jobs.deploy-trafego.sql) (substituir `__CRON_SECRET_HERE__` e colar no **SQL Editor** do Supabase).

```sql
SELECT cron.schedule(
  'compute-health-scores-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<SEU_REF>.supabase.co/functions/v1/compute-health-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Repita o padrão para `evaluate-alerts` (ex.: horário `0 * * * *`) e `whatsapp-summary?period=daily|weekly`.

### Checklist de produção

- **`CRON_SECRET`**: gere um valor seguro nas secrets das Edge Functions antes de registar cron jobs (`Authorization: Bearer <CRON_SECRET>`).
- **`pg_cron`**: após criar/edits, confira `SELECT * FROM cron.job;` e rode um job ao minuto seguinte nos logs das functions.
- **`PORTAL_ALLOWED_ORIGINS`**: defina quando o portal estiver atrás do teu domínio (lista separada por vírgulas).
- **Rotação de chaves**: se alguma migration antiga tiver exposto JWT ou URLs fixas, faça novo deploy/secrets antes de público amplos.
- **Limites**: a migration mais recente aplica limite `max_clients` via RLS nos inserts pela API ao **client autentificado** (`subscriptions` ausente conta como 5).

### Métricas reais (`sync-platform`)

- **Meta Ads**: token + Account ID → insights por **campanha** (fallback conta); **janela em dias** e granularidade **conta vs campanha** configuráveis em `integrations.config` (UI em Integrações) → grava **`campaigns`** + **`metrics_daily`**.
- **Google Ads / TikTok / GA4**: mesma janela (`sync_days`); Google Ads exige developer token e GA4 usa refresh quando há OAuth.
- **GA4**: access token OAuth (escopo read) no campo de API da integração + **Property ID** no campo conta → relatório diário (métricas derivadas de sessões/eventos).

### Buckets de storage

As migrations criam buckets `branding` (público) e `reports` (privado por agência via RLS).

## CI

O workflow `.github/workflows/ci.yml` executa lint, testes e build com variáveis placeholder para o Vite (Node **22.19+**, alinhado ao Lighthouse e ao Playwright).

### E2E smoke (Playwright)

Workflow manual [`.github/workflows/e2e-smoke.yml`](.github/workflows/e2e-smoke.yml). Corre `npm run test:e2e` contra o ambiente definido em `E2E_BASE_URL`.

| Secret | Descrição |
| ------ | --------- |
| `E2E_BASE_URL` | URL pública do frontend (sem barra final) |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` | Credenciais de conta de teste |

Localmente: `npx playwright install chromium` (uma vez) e `npm run test:e2e` com as mesmas variáveis de ambiente.

### Supabase DB lint (opcional)

Workflow manual [`.github/workflows/supabase-db-lint.yml`](.github/workflows/supabase-db-lint.yml) — executa `supabase db lint` com `continue-on-error` até haver projeto linkado na CI.

### PageSpeed / Lighthouse (produção + rotas autenticadas)

O workflow [`.github/workflows/pagespeed.yml`](.github/workflows/pagespeed.yml) corre na segunda-feira (UTC) e pode ser disparado manualmente (**Actions → PageSpeed → Run workflow**). Usa Puppeteer para entrar em `/login` com uma conta de teste e grava um JSON por rota em `lighthouse-reports/` (artefacto `lighthouse-reports`), mais `summary.json` com scores agregados.

**Secrets do repositório** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Descrição |
| ------ | --------- |
| `LIGHTHOUSE_BASE_URL` | URL pública do frontend (sem barra final), ex. `https://app.example.com` |
| `PERF_TEST_EMAIL` | E-mail da conta de teste (apenas para CI) |
| `PERF_TEST_PASSWORD` | Palavra-passe da conta de teste |
| `PERF_URLS` | (Opcional) Lista separada por vírgulas de paths; se vazio, usa `/dashboard`, `/clients`, `/reports`, `/actions`, `/ai-review`, `/integrations` |

**Localmente** (não commitar credenciais): define `LIGHTHOUSE_BASE_URL`, `PERF_TEST_EMAIL` e `PERF_TEST_PASSWORD` no ambiente, por exemplo PowerShell `$env:LIGHTHOUSE_BASE_URL="https://..."` ou bash `export LIGHTHOUSE_BASE_URL=https://...`, depois:

```bash
npm run perf:lighthouse
```

Os ficheiros ficam em `lighthouse-reports/` (ignorados pelo Git).

## Prompts IA v3

Os Prompts v3 foram incorporados em formato **docs-first**: documentação e versionamento primeiro, rollout técnico depois.

### Onde estão os prompts

- `docs/prompts/v3/01-analise-mensal-gestor.md`
- `docs/prompts/v3/02-analise-mensal-cliente.md`
- `docs/prompts/v3/03-analise-sob-demanda.md`
- `docs/prompts/v3/04-alerta-whatsapp.md`
- `docs/prompts/v3/05-pauta-reuniao.md`
- `docs/prompts/v3/06-inteligencia-concorrentes.md`
- `docs/prompts/v3/_template.md`

### Governança e segurança

- Todas as respostas devem persistir texto + JSON estruturado + metadados (cliente, plataforma, período, tipo de análise, confiança, revisão humana, ação recomendada, status e timestamp).
- Mensagens para cliente final (inclusive cenários de crise) exigem revisão humana do gestor antes de envio.
- O sistema não deve enviar alerta sem ação clara.
- Alertas iguais não devem repetir em menos de 24h.
- Sempre que houver ação recomendada, permitir converter em tarefa operacional.

### Ordem recomendada de implementação (rollout)

1. Prompt 04 — Alerta WhatsApp
2. Prompt 03 — Análise sob demanda
3. Prompt 02 — Análise mensal para cliente final
4. Prompt 01 — Análise mensal para gestor
5. Prompt 05 — Pauta de reunião
6. Prompt 06 — Inteligência de concorrentes

### Mapeamento prompt -> função/tela atual

- Prompt 01/02 -> `supabase/functions/generate-report/index.ts` + `src/routes/_authenticated/reports.tsx`
- Prompt 03 -> ação de análise contextual em `src/routes/_authenticated/clients.$clientId.tsx`
- Prompt 04 -> `supabase/functions/evaluate-alerts/index.ts` e envio em `supabase/functions/send-whatsapp/index.ts`
- Prompt 05 -> `supabase/functions/generate-meeting-report/index.ts`
- Prompt 06 -> `supabase/functions/sync-competitors/index.ts` + `src/routes/_authenticated/competitors.tsx`

### Política de deduplicação de alertas (v3)

- Janela padrão de deduplicação: `24h` por cliente + plataforma + tipo de gatilho.
- Se o problema não piorou e já existe alerta recente, não reenviar.
- Priorizar alertas por severidade e potencial impacto financeiro.
