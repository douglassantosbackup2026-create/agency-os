## Objetivo
Permitir que o lead compre gestão de tráfego direto na página `/gestao-trafego-obrigado`, com **cartão e Pix**, sem depender de diagnóstico prévio.

## Abordagem — Checkout Pro (redirect) via Mercado Pago
Reusar o padrão de `create-management-checkout` (Checkout Pro hospedado do MP) em vez de reconstruir Bricks + Pix inline. Vantagens: **1 endpoint**, cobre cartão + Pix + boleto automaticamente, sem coletar CPF/dados de cartão no nosso frontend, sem novas telas complexas.

## Alterações

### 1. Backend — nova Edge Function `create-lead-checkout`
Arquivo: `supabase/functions/create-lead-checkout/index.ts`
- POST `{ lead_id: string }`
- Rate-limit por IP (reusa `publicRateLimitExceeded`).
- Valida lead existe em `ecommerce_leads` via service client.
- Se `status === 'paid'` → 400.
- Cria preferência MP: item R$ 4.997, `external_reference: lead:<lead_id>`, `notification_url` → `mercadopago-webhook`, `back_urls.success` → `${SITE}/gestao-obrigado-lead?lead=<id>`, `failure`/`pending` → volta para `/gestao-trafego-obrigado?lead=<id>&checkout=<status>`.
- Atualiza `ecommerce_leads`: `status='awaiting_payment'`, guarda `mp_preference_id` e `amount_cents`.
- Retorna `{ init_point }`.

### 2. Migração — colunas extras em `ecommerce_leads`
Novo arquivo em `supabase/migrations/`:
```sql
ALTER TABLE public.ecommerce_leads
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
```
(status já existe e vira `'awaiting_payment' | 'paid' | 'new'`.)

### 3. Webhook — estender `mercadopago-webhook`
Detectar `external_reference` com prefixo `lead:` e, quando pagamento aprovado, atualizar o lead: `status='paid'`, `mp_payment_id`, `paid_at=now()`. (Mantém lógica existente para `mgmt:` intacta.)

### 4. Frontend — server fn wrapper
Novo `src/lib/lead-checkout.functions.ts` (server fn `createLeadCheckout`) que chama a edge function via service (ou usar `callDiagnosisApi`-style fetch pública). Retorna `init_point`.

### 5. Frontend — botão na página `gestao-trafego-obrigado.tsx`
Adicionar botão primário **"Pagar agora — Cartão ou Pix"** acima do WhatsApp (WhatsApp vira secundário). Estados: loading, erro inline. Ao clicar → chama server fn → `window.location.href = init_point`.

Layout dentro do card de urgência:
- Botão 1 (primário, roxo/gradiente): "Pagar agora e garantir vaga · Cartão ou Pix"
- Divisor "ou"
- Botão 2 (secundário, outline): "Prefere falar antes? WhatsApp" (link atual)

### 6. Nova rota simples `/gestao-obrigado-lead?lead=<id>`
Página de confirmação pós-pagamento: mensagem "Pagamento recebido — Douglas vai chamar no WhatsApp em até 24h" + Meta Pixel `Purchase`.

## Fora de escopo
- Não altero `/gestao-checkout` (fluxo de diagnóstico).
- Não implemento Bricks/Pix inline (Checkout Pro cobre ambos).
- Não crio dashboard admin para leads pagos (dados ficam disponíveis via `PlatformEcommerceLeads` existente).

## Nota técnica
Requer secret `MERCADOPAGO_ACCESS_TOKEN` e `PUBLIC_SITE_URL` já configurados (usados pela `create-management-checkout`). Nenhuma nova secret necessária.
