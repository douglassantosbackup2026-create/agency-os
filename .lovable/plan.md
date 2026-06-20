# Quebrar funil de checkout em sub-etapas (payment_info)

Hoje o motor mede checkout como um bloco único (`initiate_checkout → purchase`). Isso confunde dois perfis opostos: quem abandona **antes** do pagamento vs. quem abandona **na finalização** (gateway/Pix/frete-surpresa). Vamos extrair o evento `add_payment_info` e diagnosticar cada perfil separadamente.

## Arquivos a alterar (somente servidor + um componente de exibição)

- `supabase/functions/_shared/diagnosis/derive-analysis.ts` — extrair `add_payment_info`, ampliar `ConversionFunnel`, dividir bottleneck `checkout` em `checkout_early` vs `checkout_late`, calcular `revenueAtRiskMonthlyBrl` para cada caso, expor flag `paymentInfoTracked`.
- `supabase/functions/_shared/diagnosis/derive-growth-intelligence.ts` — em `buildMoneyLeaks`, gerar título e `rootCause` contextual para cada sub-bottleneck (não mais "checkout fraco" genérico).
- `supabase/functions/_shared/diagnosis/v3-growth-intelligence-rules.ts` — atualizar a regra #2 do bloco "VALIDAÇÃO ANTI-TEMPLATE" para exigir que a narrativa cite o sub-bottleneck correto e a causa provável correspondente, e instruir a IA a reportar limitação quando `paymentInfoTracked === false`.
- `src/components/diagnosis-report/types.ts` — adicionar campos opcionais `paymentInfo`, `paymentInfoRate`, `purchaseFromPaymentRate`, `paymentInfoTracked`, `bottleneckDetail` em `ConversionFunnelView`.
- `src/components/diagnosis-report/presentation/DiagnosisConversionFunnelBlock.tsx` — exibir o passo "Inseriu dados de pagamento" quando rastreado, mostrar as duas taxas, e trocar o alerta atual por mensagem específica do sub-bottleneck (ou aviso de limitação se não rastreado).
- Testes em `supabase/functions/_shared/diagnosis/derive-growth-intelligence.test.ts` (e/ou um novo `derive-analysis.test.ts` se ainda não houver).

Nenhuma mudança de schema, RLS, edge function de borda, estilos ou layout do relatório.

## Mudanças de motor

### 1. Extrair `add_payment_info`
Novo padrão em `derive-analysis.ts`:
```
const PAYMENT_INFO_PATTERNS = [
  /^add_payment_info$/i,
  /offsite_conversion\.fb_pixel_add_payment_info/i,
  /fb_pixel_add_payment_info/i,
];
```
No loop de `deriveFunnelAnalysis`, somar `paymentInfo` por campanha de família `sales`. Calcular:
- `paymentInfoRate = (paymentInfo / checkout) * 100` quando `checkout > 0 && paymentInfo > 0`
- `purchaseFromPaymentRate = (purchase / paymentInfo) * 100` quando `paymentInfo > 0 && purchase > 0`
- `paymentInfoTracked = paymentInfo > 0` (evento configurado pelo lojista; se ausente, não dá pra separar os perfis).

### 2. Subdividir bottleneck `checkout`
Substituir o ramo `purchaseRate < 35` por:
- `paymentInfoTracked` E `paymentInfoRate < 60` → `bottleneck = "checkout_early"`, label "Abandono no início do checkout — antes do pagamento". Causa provável: frete revelado tarde, login obrigatório, indecisão.
- `paymentInfoTracked` E `paymentInfoRate >= 60` E `purchaseFromPaymentRate < 50` → `bottleneck = "checkout_late"`, label "Abandono na finalização — provável gateway, método de pagamento ausente ou frete-surpresa".
- `!paymentInfoTracked` E `purchaseRate < 35` E `checkout >= 5` → manter `bottleneck = "checkout"` (estado degradado, igual ao de hoje, mas o label deixa claro que `add_payment_info` não está no Pixel e por isso não é possível distinguir os perfis).

ATC e LPV ficam como hoje.

### 3. Receita em risco por sub-bottleneck
- `checkout_late`: usar `calcularImpactoCheckout` partindo de `paymentInfo` (base = quem já passou do gargalo precoce) em vez de `checkout`. Compras potenciais = `paymentInfo * (purchaseRefFromPayment ≈ 0.7)`; lucro perdido = `(potencial − purchase) * ticket`. Esse é "o mais caro de ignorar" — quem já decidiu comprar.
- `checkout_early`: potencial = `checkout * 0.6` (referência de avanço ao pagamento) `* refCheckoutCompra`; perdidas = `potencial − purchase`.
- `checkout` (fallback sem `add_payment_info`): mantém comportamento atual.
- Gates atuais (≥ 30 BRL, etc.) preservados.

### 4. Tipo e contrato
Estender `ConversionFunnel`:
```
paymentInfo: number;
paymentInfoRate: number | null;        // checkout → payment_info
purchaseFromPaymentRate: number | null; // payment_info → purchase
paymentInfoTracked: boolean;
bottleneck: "lpv" | "atc" | "checkout" | "checkout_early" | "checkout_late" | "none" | "insufficient_data";
```
Atualizar `normalizeAnalysisV2` / `ConversionFunnelView` para passar os novos campos ao front.

### 5. Money leaks contextuais (`derive-growth-intelligence.ts`)
Onde hoje cria leak "Abandono no checkout":
- `checkout_late` → title "Abandono na finalização (após inserir pagamento)", rootCause cita as 3 causas (gateway recusando, método ausente, frete-surpresa), recomendação "auditar gateway, adicionar Pix, revelar frete antes do último passo". Categoria `structure`. É o leak de maior prioridade dentro da família funil — promover para o top quando existir.
- `checkout_early` → title "Abandono no início do checkout (antes do pagamento)", rootCause "frete revelado tarde / login obrigatório / fricção de formulário".
- `checkout` (sem `add_payment_info`) → title atual "Abandono no checkout", rootCause acrescenta "evento add_payment_info não rastreado — instale para isolar a causa".

### 6. Regra de narrativa
Em `V3_GROWTH_INTELLIGENCE_RULES`, regra #2 passa a exigir:
- se `conversion_funnel.bottleneck === "checkout_late"`, a narrativa cita explicitamente "gateway / método de pagamento / frete no último passo" — proibido falar em "copy" ou "oferta";
- se `checkout_early`, citar "primeira tela do checkout / frete / login";
- se `paymentInfoTracked === false`, registrar limitação ("evento add_payment_info não rastreado — não é possível distinguir Perfil A de Perfil B") e não chutar causa.

### 7. UI (mínimo)
`DiagnosisConversionFunnelBlock`:
- Inserir um 5º card "Inseriu pagamento" entre "Checkout iniciado" e "Compras" quando `paymentInfoTracked`. Caso contrário, manter 4 cards e exibir um aviso discreto "Evento add_payment_info não rastreado — funil pós-checkout não foi possível subdividir".
- Trocar o `<p className="premium-alert-box">` por mensagem específica do sub-bottleneck (mantém o mesmo componente/estilo).

## Testes
Em `derive-growth-intelligence.test.ts` (ou novo `derive-analysis.test.ts`):
- Fixture sintética com `paymentInfo` alto e `purchase` baixo → bottleneck `checkout_late`, leak com título "finalização (após inserir pagamento)".
- Fixture com `paymentInfo` baixo vs `checkout` → bottleneck `checkout_early`.
- Fixture sem `add_payment_info` → bottleneck `checkout` legado, leak menciona limitação de rastreamento.
- `purchaseFromPaymentRate ≥ 50` e `paymentInfoRate ≥ 60` → sem leak de checkout.

## Fora de escopo
- Configuração do Pixel/CAPI do lojista (instrução de instalar `add_payment_info` aparece só no texto do leak).
- Mudança visual além do 5º card e do texto do alerta.
- Quebrar outros eventos (ex.: `add_shipping_info`) — fica para iteração futura.

## Validação pós-implementação
- `bunx vitest run supabase/functions/_shared/diagnosis`
- Reprocessar 1 diagnóstico real via `scripts/ops-reprocess-diagnosis.mjs <id>` em conta com `add_payment_info` rastreado e outra sem, conferindo que (a) o card extra aparece, (b) o leak fala em "finalização" / "gateway" só quando faz sentido, (c) a soma continua batendo com o headline.
