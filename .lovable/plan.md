# Adicionar seleção de conta de anúncio Meta

## Problema

Hoje, em `supabase/functions/meta-oauth-callback/index.ts` (linhas 220-234), após o OAuth pegamos **`accounts[0]`** automaticamente:

```ts
const accounts = await fetchAdAccounts(userToken);
const first = accounts[0];
// ...
const actId = first.id.startsWith("act_") ? first.id : `act_${first.account_id}`;
```

Quem tem múltiplas contas Meta (agência, conta pessoal, conta do cliente) fica refém da ordem que a Graph API retorna — não há tela para escolher. Resultado: muitos diagnósticos analisam a conta errada.

## Solução

Quebrar o fluxo em 2 passos:

1. **Callback** apenas guarda o token + lista de contas e leva o usuário a uma tela de escolha.
2. **Nova tela `/diagnostico/conectar`** mostra as contas (nome, id, moeda, status) e o usuário clica em "Analisar esta conta" → confirma a escolha → dispara o `process-diagnosis`.

Quando a Meta devolve **apenas 1 conta**, pulamos a tela e mantemos o comportamento atual (auto-seleção) para não adicionar fricção.

## Mudanças

### 1. DB (migração)
Adicionar coluna `pending_ad_accounts jsonb` em `diagnoses` (cache temporário da lista, expira ao confirmar). Status novo: `awaiting_account_selection`.

### 2. `meta-oauth-callback/index.ts`
- Buscar **todas** as contas via `me/adaccounts` com campos: `id, account_id, name, currency, account_status, business_name`.
- Guardar token em `diagnosis_secrets` (igual hoje).
- Se `accounts.length === 1`: comportamento atual (auto-seleciona, status `processing`, dispara cron).
- Se `accounts.length > 1`: salvar `pending_ad_accounts = accounts`, status `awaiting_account_selection`, redirect → `/diagnostico/{id}/conectar?s={slug}`.
- Se `0`: igual hoje (`oauth_error=noadaccounts`).

### 3. Nova edge function `confirm-ad-account`
- POST `{ diagnosisId, secretSlug, accountId }`.
- Valida que `accountId` está dentro de `pending_ad_accounts`.
- Atualiza `diagnoses`: `meta_ad_account_id = act_<accountId>`, `status = 'processing'`, `pending_ad_accounts = null`.
- Chama `triggerProcess()` (mesma função fire-and-forget do callback).

### 4. Nova rota `src/routes/diagnostico.$diagnosisId.conectar.tsx`
- Carrega via função publicamente acessível (`diagnosis-status` já existe) ou nova `get-pending-accounts`.
- Lista cards de contas com nome, ID, moeda, status (Ativa/Desativada). Destaca contas inativas.
- Botão "Analisar esta conta" → chama `confirm-ad-account` → redirect `/obrigado?d=…&s=…&step=processing`.
- Estados: loading, erro, "sessão expirada" (re-OAuth).

### 5. Página `/obrigado`
- Quando `status === 'awaiting_account_selection'`, mostrar CTA "Escolher conta de anúncio" → `/diagnostico/{id}/conectar`.

## O que NÃO muda
- `process-diagnosis` (v2 prompt), cron, fallback de providers, telemetria, MercadoPago, `diagnosis_secrets`, fluxo `awaiting_connection`.
- Diagnósticos com 1 conta continuam 1-clique.

## Riscos
- Token Meta de longa duração já está salvo → safe esperar usuário escolher.
- Garantir RLS: `pending_ad_accounts` só lido via edge function com `secret_slug` (não expor via Data API).
