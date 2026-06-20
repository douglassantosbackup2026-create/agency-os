## Fase 2 — Subscription real no Mercado Pago

Antes de implementar, preciso confirmar decisões importantes — algumas mudam radicalmente o escopo.

## Restrições reais do Mercado Pago (Brasil)

A API de assinaturas do MP é a **Preapproval** (`/preapproval`). Hoje ela tem limitações que afetam diretamente o seu fluxo atual:

| Método | Suporte a recorrência automática? |
|---|---|
| **Cartão de crédito** | Sim — débito automático mensal real |
| **Pix** | Não para assinatura tradicional. Existe "Pix Automático" do BCB (novo, em rollout), mas o MP ainda não expõe via Preapproval clássica de forma estável |
| **Boleto** | Não |

**Consequência:** se quiser cobrança automática mensal de verdade, hoje só dá com cartão. O Pix continua existindo como "1ª mensalidade" e nos meses seguintes você manda link novo manualmente (o que já está comunicado na Fase 1).

## Caminhos possíveis

### Opção A — Híbrido (recomendado)
- **Cartão:** vira assinatura real (Preapproval). Cobrança automática mensal pelo MP. Cliente pode cancelar.
- **Pix:** continua como "1ª mensalidade" e o time envia link novo todo mês via WhatsApp (como já está comunicado).
- **UX:** mantém os dois métodos lado a lado, mas o cartão ganha selo "Renovação automática" e o Pix ganha "Renovação manual mensal".

### Opção B — Só cartão
- Remove Pix. Todo mundo entra como assinatura real.
- Mais simples no backend, mas perde 50%+ das conversões no Brasil (Pix tem altíssima preferência).

### Opção C — Manter Fase 1 e adiar Fase 2
- Você opera Fase 1 por 1–2 meses, mede churn e fricção da cobrança manual, e decide depois.

**Minha recomendação: Opção A.** Quer prosseguir com ela? (Se preferir B ou C, me diga e ajusto o plano.)

---

## Escopo da Opção A

### Backend (Supabase + edge functions)

1. **Nova tabela `management_subscriptions`** (migração):
   - `id`, `diagnosis_id` (FK), `mp_preapproval_id`, `status` (`pending` | `authorized` | `paused` | `cancelled`), `amount_cents`, `frequency` (1 = mensal), `next_payment_date`, `last_event_at`, `card_last4`, timestamps.
   - GRANTs + RLS (service_role only; leitura por `secret_slug` via server function).

2. **`process-management-payment` (cartão)** — atualizar:
   - Quando `method === "card"`, em vez de criar `payment` único, cria um **`preapproval`** no MP com:
     - `reason: "Gestão de Tráfego Meta Ads — mensal"`
     - `auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 1997.00, currency_id: "BRL" }`
     - `card_token_id` do MP SDK
     - `payer_email`
     - `back_url` (página de obrigado)
   - Salva `mp_preapproval_id` em `management_subscriptions` e marca `diagnoses.management_status = 'pending_authorization'`.
   - Quando o MP retorna `authorized`, marca `paid` (1ª cobrança acontece imediatamente).

3. **`mercadopago-webhook`** — adicionar handlers:
   - `preapproval` events: atualizar `management_subscriptions.status`.
   - `authorized_payment` events (cobranças mensais subsequentes): inserir em `diagnosis_handoff_events` ou nova tabela `subscription_charges`, atualizar `next_payment_date`, disparar alerta interno em caso de falha (`recurring_charge_failed`).

4. **Nova server function `cancel-management-subscription`**:
   - Cliente pode cancelar via página `/gestao-obrigado` ou link enviado no WhatsApp.
   - Chama `PUT /preapproval/{id}` com `status: "cancelled"` no MP.
   - Atualiza tabela local + dispara alerta interno para a agência.

5. **Alerta interno** quando uma cobrança recorrente falha (card expired, insufficient funds): cria entrada em `alerts` para o time agir (já temos o padrão da Fase 1).

### Frontend

6. **`/gestao-checkout`** ajustes:
   - Toggle Pix/Cartão ganha sub-rótulos: "Pix — renovação manual" / "Cartão — renovação automática mensal".
   - No cartão, abaixo do botão: "Ao confirmar, você autoriza a cobrança mensal recorrente de R$ 1.997 pelo Mercado Pago. Cancele quando quiser."
   - Checkbox opcional de consentimento (recomendado para reduzir chargeback): "Autorizo cobranças mensais de R$ 1.997 até eu cancelar".

7. **`/gestao-obrigado`** ajustes:
   - Quando `subscription.status === 'authorized'`: mostrar bloco "Próxima cobrança em DD/MM/AAAA" e botão "Gerenciar assinatura" (modal ou link → server fn de cancelamento com confirmação).
   - Quando Pix: mantém a copy atual ("link manual no WhatsApp").

8. **Nova rota `/gestao-assinatura?d=...&s=...`** (opcional, mas recomendada):
   - Cliente vê status, próxima cobrança, histórico, e pode cancelar.
   - Mesma proteção por `secret_slug` que o resto do funil.

### Configuração / secrets

- O MP token já existe (`MERCADOPAGO_ACCESS_TOKEN`). Preapproval usa o mesmo token, sem segredo novo.
- Configurar no painel MP: URL de webhook para receber `preapproval` e `subscription_authorized_payment` events.

## Arquivos afetados

- Migração: `management_subscriptions` table + GRANTs/RLS.
- Edge functions: `process-management-payment/index.ts`, `mercadopago-webhook/index.ts`, novas `cancel-management-subscription/index.ts` e `management-subscription-status/index.ts`.
- Frontend: `src/routes/gestao-checkout.tsx`, `src/routes/gestao-obrigado.tsx`, novo `src/routes/gestao-assinatura.tsx` (se quiser).
- Conteúdo: pequenas adições em `src/content/gestao-checkout.ts` (copy de consentimento, sub-rótulos).

## Fora deste plano

- Pix Automático (BCB) — esperar maturidade do MP.
- Migração dos pagamentos únicos já feitos para assinatura (faria caso a caso, manualmente).
- Cobrança de setup separado (tudo entra no mesmo valor mensal).

## O que preciso de você antes de executar

1. Confirmar **Opção A** (híbrido) — ou escolher B/C.
2. Você quer a página `/gestao-assinatura` para self-service de cancelamento, ou prefere que o cancelamento seja só via WhatsApp/equipe (mais simples)?
3. O webhook do MP precisa ser configurado no painel — você consegue acessar ou quer que eu te passe instruções passo a passo depois?
