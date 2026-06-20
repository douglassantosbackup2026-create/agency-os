## Objetivo

Aumentar a conversão e reduzir chargebacks na página `/gestao-checkout` aplicando os 6 ajustes priorizados (1, 2, 3, 4, 5 e 7).

## Decisão importante sobre recorrência

Você disse que o produto é **mensal recorrente**, mas hoje o fluxo Mercado Pago cobra **pagamento único** (Pix/cartão à vista, sem subscription). Trocar para subscription real é uma mudança grande no backend (MP Preapproval, webhook, gerenciamento de status mensal, cancelamento). Proponho dividir em duas fases:

- **Fase 1 (este plano):** comunicar honestamente como "1ª mensalidade — R$1.997/mês", explicar que a renovação acontece por cobrança manual mensal (link novo) até a subscription estar pronta, e adicionar todos os outros ajustes.
- **Fase 2 (plano separado):** implementar Mercado Pago Preapproval (subscription real com cobrança automática).

Se preferir, posso já incluir a Fase 2 neste plano — só me diga.

---

## Mudanças (Fase 1)

### 1. Recorrência explícita (`/gestao-checkout` + `/gestao-obrigado`)
- Resumo do pedido: preço grande "**R$1.997**" com sublinha "**/mês — 1ª mensalidade**".
- Bloco curto abaixo do resumo: "Cobrança mensal. Hoje você paga a 1ª mensalidade; nos próximos meses enviaremos um novo link de pagamento (ainda não há débito automático)."
- CTA dos botões: "Pagar 1ª mensalidade com Pix — R$1.997/mês" e equivalente no cartão.
- Página de obrigado: confirmar "1ª mensalidade recebida" e quando virá a próxima.
- Pixel/Meta Purchase: manter valor, adicionar `content_category: "subscription_first_charge"`.

### 2. Garantia / política de cancelamento
- Editar `GESTAO_GUARANTEE` em `src/content/gestao-checkout.ts` para algo como: "Sem fidelidade. Cancele quando quiser — basta avisar no WhatsApp antes do próximo ciclo."
- Mover o bloco para logo acima do botão de pagamento (hoje fica entre entregáveis e formulário; perde força).
- Adicionar microcopy abaixo do botão: "Sem fidelidade · Cancele a qualquer momento".

### 3. Elemento humano (Douglas + prova social)
- Novo componente `GestaoOperatorCard` ao lado/abaixo do formulário de pagamento:
  - Foto do Douglas (asset já existente, usar a do relatório v1; se não houver, peço para você subir).
  - Nome + cargo: "Douglas — Gestor responsável pela sua conta".
  - 1 linha de credencial curta.
- Novo componente `GestaoSocialProof`: 1 depoimento curto (cliente + resultado) acima ou abaixo do bloco de garantia.
- Conteúdo (foto, bio, depoimento) vai em `src/content/gestao-checkout.ts` para você editar fácil.

### 4. Pré-preencher site/Instagram
- **Já existe parcialmente** (linhas 207-217): se `management_business_name/website/instagram` vierem do diagnóstico, são pré-preenchidos.
- Gap atual: quando o diagnóstico **não** tem esses campos salvos mas tem `business_name`, `website` ou `instagram_handle` no próprio `diagnoses` (campos do funil), eles não são usados.
- Ajuste no endpoint `diagnosis-report` (server function): se `management_*` for null, fazer fallback para os campos originais do diagnóstico (`business_name`, `website_url`, `instagram`).
- UX: mostrar badge "Detectado da sua conta Meta" ao lado dos campos pré-preenchidos, com link "editar".

### 5. O que acontece depois de pagar
- Novo bloco "Depois do pagamento" abaixo da garantia, com 3 passos curtos:
  1. Confirmação por e-mail em segundos.
  2. Em até 24h, Douglas chama você no WhatsApp para onboarding.
  3. Primeiras campanhas no ar em até 5 dias úteis.
- Reforçar o mesmo conteúdo na `/gestao-obrigado` (já existe parcial, alinhar texto).

### 7. Escassez visível ("2 vagas")
- Hoje: `gestaoUrgencyText() · 2 vagas disponíveis` em cinza no rodapé.
- Mudança: badge destacado no topo do resumo do pedido — "**Apenas 2 vagas neste mês**" com ícone, cor de alerta sutil (não vermelho berrante).
- Remover do rodapé para não duplicar.
- **Pergunta:** a escassez é real (controlada manualmente) ou fixa em "2"? Se for manual, deixo o número editável via `src/content/gestao-checkout.ts`. Se quiser dinâmico (contar pagamentos do mês no banco), me avise.

---

## Arquivos afetados

- `src/routes/gestao-checkout.tsx` — reordenação de seções, novos blocos, CTA, badge de vaga.
- `src/routes/gestao-obrigado.tsx` — confirmação de 1ª mensalidade, próximos passos.
- `src/content/gestao-checkout.ts` — copy de garantia, operador, depoimento, vagas, próximos passos.
- `src/components/gestao/GestaoOperatorCard.tsx` (novo).
- `src/components/gestao/GestaoSocialProof.tsx` (novo).
- `src/components/gestao/GestaoNextSteps.tsx` (novo).
- Server function `diagnosis-report` (`src/lib/diagnosis-api.functions.ts` ou similar) — fallback de pré-preenchimento.

## Fora deste plano

- Subscription real no Mercado Pago (Fase 2).
- Parcelamento no cartão (item 6) — você não selecionou; posso adicionar se quiser.
- Reescrita do CTA com valor do gap (item 8) — não selecionado.

Quer que eu inclua a Fase 2 (subscription real) ou seguimos só com a Fase 1?
