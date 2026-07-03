## Mapeamento atual do funil de gestão

Rota | Momento | Eventos disparados
- /gestao-trafego (landing) | Visualização da landing | PageView + ViewContent(GESTAO_PRODUCT)
- submit do formulário (useEcommerceLeadSubmit) | Lead envia dados | Lead(GESTAO_PRODUCT) + CompleteRegistration
- /gestao-trafego-obrigado (proposta) | Página atual | PageView apenas
- /gestao-trafego-checkout | Início do pagamento | InitiateCheckout(GESTAO_PRODUCT)
- /gestao-obrigado-lead | Pagamento confirmado | Purchase(GESTAO_PRODUCT)

## O que deve disparar em /gestao-trafego-obrigado

1. **PageView** — manter. Já está no `useEffect` da página.
2. **ViewContent do GESTAO_PRODUCT** — adicionar. Sinaliza que o lead visualizou a proposta de gestão, preenchendo a etapa entre o envio do formulário e o início do checkout. Recomenda-se usar `content_name: "Proposta Gestão de Tráfego E-commerce"`.
3. **Não disparar** `Lead`, `InitiateCheckout` ou `Purchase` nesta página — esses eventos pertencem a etapas posteriores (Lead já dispara no submit, InitiateCheckout no checkout e Purchase após pagamento).

## Implementação proposta

Em `src/routes/gestao-trafego-obrigado.tsx`:
- Atualizar o import de `@/lib/meta-pixel` para incluir `GESTAO_PRODUCT` e `trackMetaViewContent`.
- No `useEffect` existente, chamar `trackMetaViewContent(GESTAO_PRODUCT, { content_name: "Proposta Gestão de Tráfego E-commerce" })` junto com `trackMetaPageView()`.
- Não alterar o fluxo de checkout, pagamento, edge functions ou schema.

## Fora de escopo
- Não remover o evento `Lead` que já dispara corretamente no `useEcommerceLeadSubmit`.
- Não mexer nos eventos de Purchase, InitiateCheckout ou AddPaymentInfo de outras páginas.
- Não alterar textos, layout ou lógica de vagas.