# Retentio (agency-os)

Plataforma operacional para agências de tráfego: health score, alertas, relatórios com IA, portal do cliente e integrações.

Código-fonte: [douglassantosbackup2026-create/agency-os](https://github.com/douglassantosbackup2026-create/agency-os) (`origin`).

```bash
git remote add origin https://github.com/douglassantosbackup2026-create/agency-os.git   # só se ainda não existir
git remote -v                                                                            # deve mostrar esse URL como origin
```

Se `git push` devolver **403**, o Git está a usar uma conta sem permissão de escrita: corre `gh auth login` (repo [agency-os](https://github.com/douglassantosbackup2026-create/agency-os)) ou remove credenciais antigas do Gestor de credenciais do Windows para `github.com` e volta a autenticar com a conta dona/colaboradora.

## Requisitos

- Node.js 22+
- Conta [Supabase](https://supabase.com) (projeto com migrations e Edge Functions deste repositório)

## Variáveis de ambiente

Crie `.env` na raiz (ou configure no host de deploy):

| Variável                        | Descrição                                  |
| ------------------------------- | ------------------------------------------ |
| `VITE_SUPABASE_URL`             | URL do projeto (ex.: `https://uvuotaxikuxejfeitlaw.supabase.co` para o ambiente Trafego) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (anon / publishable)      |

Modelo: copie [`.env.example`](.env.example) para `.env` e preencha as chaves (o ficheiro `.env` não deve ser commitado).

## Comandos

```bash
npm ci
npm run dev          # desenvolvimento
npm run lint
npm run test         # testes unitários (Vitest)
npm run build        # build de produção (requer env acima)
```

## Supabase local

```bash
npx supabase link --project-ref <ref>
npx supabase db push    # migrations
npx supabase functions serve   # opcional: testar functions localmente
```

### Secrets das Edge Functions

Configure no Dashboard do Supabase (**Edge Functions → Secrets**):

| Secret                                    | Uso                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CRON_SECRET`                             | Chamadas agendadas devem usar `Authorization: Bearer <CRON_SECRET>` ou `x-cron-secret`. Utilizadores autenticados podem invocar as mesmas functions com o JWT da sessão. Sem `CRON_SECRET`, apenas `apikey` anon é aceite (legado — evitar em produção). |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` | WhatsApp via Evolution API (opcional).                                                                                                                                                                                                                                                                 |
| `PORTAL_ALLOWED_ORIGINS`                  | Lista separada por vírgula de origens permitidas para CORS no `portal-data`; se vazio, mantém `*`.                                                                                                                                                                                                     |

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

O workflow `.github/workflows/ci.yml` executa lint, testes e build com variáveis placeholder para o Vite.
