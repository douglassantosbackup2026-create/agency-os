# Edge Functions — Checklist de Segurança e Escopo

Documento vivo. Atualizar ao adicionar ou modificar funções.

---

## Padrões de autenticação aprovados

| Padrão | Descrição |
|--------|-----------|
| **JWT** | `Authorization: Bearer <token>` validado via `createClient` com `req.headers` — escopo do usuário autenticado |
| **Cron \| JWT** | `assertCronOrUser(req)` — aceita header `x-cron-secret` (interno Supabase) ou JWT válido |
| **Diagnosis secret** | Header `x-diagnosis-id` com slug hex — vinculado ao diagnóstico do usuário, sem auth Supabase |
| **Público c/ rate-limit** | Sem auth, protegido por IP rate-limit via `_shared/rate-limit.ts` |
| **Webhook externo** | Assinatura HMAC validada com secret do provider (MercadoPago) |
| **Dev harness** | Sem JWT; exige `META_TEST_ENABLED=true` + `redirect_uri` localhost — só ambiente de teste |

---

## Tabela completa (24 funções)

| Função | Auth | Body / Params | Escopo | Status |
|--------|------|---------------|--------|--------|
| campaign-ai-audit | JWT | JSON body (`client_id`) | client | ✅ OK |
| compute-health-scores | Cron \| JWT | query param `client_id` (opcional) | agency | ✅ OK |
| evaluate-alerts | Cron \| JWT | sem body | agency | ✅ OK |
| generate-meeting-report | JWT | JSON body (`client_id`, `meeting_id`) | client | ✅ OK |
| generate-report | JWT | JSON body (`client_id`) | client | ✅ OK |
| integration-oauth | JWT | JSON body | client | ✅ OK |
| invite-member | JWT | JSON body (`email`, `role`) | agency | ✅ OK |
| oauth-env-status | JWT + `platform_admin` role | sem body | platform | ✅ OK |
| portal-creative-review | Público (rate-limit) | JSON body | portal | ✅ OK |
| portal-data | Público (rate-limit) | query params | portal | ✅ OK |
| seed-demo-data | JWT + role (owner/admin) | sem body | agency | ✅ OK |
| send-whatsapp | JWT | JSON body | client | ✅ OK |
| sync-competitors | JWT | JSON body (`client_id`) | agency | ✅ OK |
| sync-platform | JWT | JSON body | client | ✅ OK |
| whatsapp-summary | Cron \| JWT | query param `agency_id` | agency | ✅ OK |
| create-diagnosis-checkout | Público | JSON body (`plan_id`) | público | ✅ OK |
| mercadopago-webhook | Webhook HMAC (MercadoPago) | JSON body | público | ✅ OK |
| meta-oauth-start | Diagnosis secret | query param `diagnosis_id` | diagnosis | ✅ OK |
| meta-oauth-callback | Diagnosis secret | query params (OAuth code/state) | diagnosis | ✅ OK |
| diagnosis-status | Diagnosis secret | query param `diagnosis_id` | diagnosis | ✅ OK |
| diagnosis-track | Diagnosis secret | JSON body (`event`, `diagnosis_id`) | diagnosis | ✅ OK |
| diagnosis-report | Diagnosis secret | query param `diagnosis_id` | diagnosis | ✅ OK |
| process-diagnosis | Cron \| JWT | query/body `diagnosis_id` | diagnosis | ✅ OK |
| meta-api-test | Dev harness | JSON body (`action`, …) | dev/test | ✅ OK |

---

## Inconsistências resolvidas

| Função | Problema anterior | Resolução |
|--------|------------------|-----------|
| seed-demo-data | Auth incerta (não documentada) | Confirmado: valida JWT + role `owner`/`admin` nas linhas 83-131 |
| process-diagnosis | Auth parcial (checklist incompleto) | Confirmado: importa e chama `assertCronOrUser` na linha 2 |

---

## Notas por escopo

### Escopo `agency`
Funções que operam sobre dados da agência inteira. Exigem membership ativo verificado via RLS ou check explícito de `agency_id` do usuário autenticado.

### Escopo `client`
Funções que operam sobre um cliente específico. Sempre recebem `client_id` no body e verificam que o usuário tem acesso a esse cliente via RLS.

### Escopo `diagnosis`
Fluxo público do produto "Diagnóstico Meta Ads". O acesso é controlado pelo slug hexadecimal do diagnóstico (`diagnosis_id`), sem conta Supabase. Usa `diagnosisServiceClient` com service role para contornar RLS — tratar com cuidado.

### Escopo `portal`
Endpoints do portal de clientes externos. Sem autenticação Supabase; protegidos por rate-limit de IP.

### Escopo `platform`
Apenas admin de plataforma (`platform_admin` role). Atualmente só `oauth-env-status`.

### Escopo `dev/test`
Harness local `/test-meta-oauth`. Função `meta-api-test`: OAuth + proxy Graph API; **não** persiste tokens na base de dados. Desactivada por omissão (`META_TEST_ENABLED` ≠ `true`).

---

## Checklist para novas funções

- [ ] Definir escopo (agency / client / diagnosis / portal / platform / público)
- [ ] Escolher padrão de auth compatível com o escopo
- [ ] Validar todos os campos obrigatórios do body/params antes de usar
- [ ] Retornar 400 para body inválido, 401 para auth falha, 403 para permissão insuficiente
- [ ] Adicionar à tabela acima com status e data
