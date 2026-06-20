# Plano: corrigir regressão de conteúdo no diagnóstico v4

A causa raiz não é o prompt da IA — os 8 motores em `derive-growth-intelligence.ts` e `derive-analysis.ts` (deterministas, servidor) estão gerando entradas redundantes, escondendo o funil de checkout e somando valores que não batem com o headline. A IA só repete o que recebe. Vamos corrigir na fonte e adicionar guarda anti-redundância.

## Arquivos a alterar (somente servidor)

- `supabase/functions/_shared/diagnosis/derive-growth-intelligence.ts` (`buildMoneyLeaks`, `buildGrowthOpportunities`, `buildExecutiveImpact`)
- `supabase/functions/_shared/diagnosis/derive-analysis.ts` (`deriveFunnelAnalysis` — ampliar gargalos elegíveis)
- `supabase/functions/_shared/diagnosis/v3-growth-intelligence-rules.ts` (acrescentar regra de validação anti-template ao prompt da IA, como rede de segurança narrativa)
- Novos testes em `supabase/functions/_shared/diagnosis/derive-growth-intelligence.test.ts` (criar se não existir)

Nenhuma mudança em UI, layout, estilos, schema, edge functions de borda ou prompt principal além das regras adicionais.

## Correções

### 1. Diversidade obrigatória nos top vazamentos
No final de `buildMoneyLeaks`, após ordenar por impacto:
- Agrupar por `category`.
- Se as 3 primeiras entradas pertencem à mesma categoria, intercalar: manter a #1, e promover a próxima de categoria diferente para a posição #2 (e assim por diante até cobrir ≥2 categorias no top 3, ≥3 categorias no top 5 quando houver).
- Dentro da mesma categoria/template, manter no máximo 1 entrada no top 3 (as demais ficam abaixo, ou são consolidadas).

### 2. Consolidar "X — abaixo do ROAS do nicho"
Loop em `adsetBleedRanking` (linhas 319–333) hoje cria 1 leak por adset com o mesmo template.
- Manter apenas o pior bleed como item individual ("[nome] — ROAS X× vs Y× do nicho, –R$…/mês").
- Os demais bleeds da mesma família agregar em **um único** item "Outros conjuntos de Vendas abaixo do nicho (n=…)" com `monthlyImpactBrl` = soma e `rootCause` listando até 3 nomes. Isso elimina os três cards idênticos do exemplo do usuário.

### 3. Retomar bloco de funil/checkout
Em `deriveFunnelAnalysis` (derive-analysis.ts) o `revenueAtRiskMonthlyBrl` só é calculado quando `bottleneck === "checkout"` AND `purchaseRate < 35` AND `checkout >= 10`. Em contas pequenas (8k/mês) os thresholds escondem o gargalo.
- Reduzir `checkout >= 10` para `>= 5`.
- Calcular `revenueAtRiskMonthlyBrl` também para `bottleneck === "atc"` (compras perdidas = atc × refAtcRate − checkout, × ticket).
- Em `buildMoneyLeaks`, baixar gate de `>= 50` para `>= 30` e usar título contextual (`Abandono no checkout` ou `Abandono no carrinho`) conforme o bottleneck.

### 4. Eliminar opportunity vaga "Recuperar eficiência de verba já investida"
Em `buildGrowthOpportunities`, só emitir esse item se houver pelo menos UMA destas evidências concretas: vencedor subinvestido, axis com nome de campanha, ou pelo menos 2 bleeds com nome — e reescrever o título para refletir o quê ("Realocar verba dos conjuntos X, Y para vencedores"). Se nada concreto, omitir o item.

### 5. Conciliar números entre headline, leaks e gap
Em `buildExecutiveImpact` o `primaryGap` é `max(gapFromMeta, wasteGap, leakSum)`. Depois de aplicar (1) e (2), o `leakSum` exibido no relatório (top 3) pode ficar menor que `primaryGap`. Mudanças:
- Calcular `topLeakSum` = soma do top N exibido e expor `gapMonthlyBrl = max(gapFromMeta, topLeakSum)`.
- Quando `gapFromMeta > topLeakSum`, adicionar **uma única** entrada residual "Gap agregado vs ROAS do nicho — não atribuído a conjuntos específicos" com o delta (`gapFromMeta − topLeakSum`), categoria `sales`, confidence `medium`. Isso elimina a sensação de dupla contagem.
- Garantir invariante: `executiveImpact.gapMonthlyBrl == sum(moneyLeaks.monthlyImpactBrl)` (testado).

### 6. Regra anti-redundância no prompt (rede de segurança)
Em `V3_GROWTH_INTELLIGENCE_RULES` adicionar bloco "VALIDAÇÃO ANTI-TEMPLATE" com as 5 checagens do usuário (categorias distintas, gargalo de funil quando há dados, oportunidade com nome+ação+valor, soma bate com headline, sem frase-template repetida). Não troca os motores — só impede a IA de re-redigir tudo como "abaixo do ROAS".

## Testes
- `buildMoneyLeaks`: dada uma conta com 5 bleeds + 1 checkout, top 3 retorna ≥2 categorias e funil aparece quando `revenueAtRiskMonthlyBrl > 0`.
- `buildMoneyLeaks`: bleeds repetidos viram 1 item "Outros conjuntos…".
- `buildExecutiveImpact`: `gapMonthlyBrl` == soma dos `moneyLeaks` exibidos.
- `deriveFunnelAnalysis`: bottleneck `atc` agora preenche `revenueAtRiskMonthlyBrl`.

## Fora de escopo
- Bloco "Douglas + prova social" (o usuário pediu — entra em plano separado, é trabalho de UI/layout no relatório, não de motor de conteúdo).
- Mudanças no prompt principal além da seção de validação.
- Visual, estilos, design tokens.

## Validação após implementar
Rodar `bunx vitest run supabase/functions/_shared/diagnosis/derive-growth-intelligence` e reprocessar 1 diagnóstico real via `scripts/ops-reprocess-diagnosis.mjs` para confirmar:
- top 3 vazamentos cobrem ≥2 categorias
- checkout/ATC volta a aparecer quando há dados
- soma dos vazamentos = headline = gap
