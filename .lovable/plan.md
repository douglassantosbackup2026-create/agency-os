## Objetivo
Subir a credibilidade do diagnóstico em três frentes do motor: (1) confiança estatística antes de prescrever ação agressiva, (2) tendência temporal real (14d vs 14d anteriores) e (3) modo "conta saudável" sem inventar problemas.

Tudo acontece no motor (`supabase/functions/_shared/diagnosis/*`) + uma camada extra de coleta na `process-diagnosis`. UI ganha 2 micro-elementos (badge de evidência e badge de tendência) sem mudança de layout.

---

## Item 1 — Confiança estatística por volume de compras

**Regra:** o `confidence` de cada `MoneyLeak` / `GrowthOpportunity` / `decisionAction` que se apoia num criativo, ad set ou campanha específica passa a ser função do volume de compras da evidência:

```
purchases ≥ 30 → confidence: "high"   → linguagem "escale agora", "duplique verba"
10 ≤ purchases < 30 → confidence: "medium" → "promissor, valide com +R$X em 7 dias"
purchases < 10 → confidence: "low"    → "sinal inicial, ainda precisa de dados"
```

**Arquivos:**
- `derive-growth-intelligence.ts`
  - Nova função `confidenceFromPurchases(n)` aplicada em todos os leaks/opportunities que carregam um ator nomeado (criativos, ad sets, campanhas).
  - Substituir os `confidence: "high"|"medium"` hardcoded nos blocos de `buildMoneyLeaks` e `buildGrowthOpportunities` quando houver `purchases` na evidência.
  - Acrescentar campo `evidenceStrength: { purchases: number; tier: "high"|"medium"|"low" }` em `MoneyLeakItem` e `GrowthOpportunityItem`.
- `v3-growth-intelligence-rules.ts`
  - Nova regra na seção "VALIDAÇÃO ANTI-TEMPLATE": "Se `evidenceStrength.tier === 'low'`, proibido usar verbos imperativos de escala (escale, duplique, dobre). Use linguagem condicional (sinal inicial, validar com mais dados)."
  - Para `'high'`, manter linguagem direta.
- `types.ts` (front): adicionar `evidenceStrength` opcional nos tipos.
- `DiagnosisMoneyLeakGrid.tsx` / `DiagnosisOpportunityGrid.tsx`: pequeno badge "Evidência: 3 compras" quando `tier === 'low'`.

**Testes (`derive-growth-intelligence.test.ts`):** fixture com criativo de 3 compras → leak rebaixado para `low` e narrativa sem imperativo de escala; fixture com 50 compras → `high`.

---

## Item 2 — Tendência temporal (14d vs 14d anteriores)

**Coleta:** em `process-diagnosis/index.ts`, ampliar `fetchAccountInsights`, `fetchCampaignInsights` e `fetchAdSetInsights` para fazer 2 chamadas em paralelo, trocando `date_preset=last_30d` por `time_range` explícito:
- atual: `{since: T-14d, until: T-1d}`
- anterior: `{since: T-28d, until: T-15d}`

Mantém a chamada `last_30d` existente como base (foto agregada). Adiciona um bloco `trends` ao payload bruto: `{ accountTrend, campaignTrends[], adsetTrends[] }` com `roas`, `spend`, `cpa`, `ctr` em cada janela + `deltaPct`.

**Análise (`derive-analysis.ts`):**
- Nova função `classifyTrend(metric, current, previous)`:
  - `deltaPct ≤ -15%` em métrica boa (ROAS, CTR) ou `≥ +15%` em ruim (CPA, CPM) → `"deteriorating"`
  - `|deltaPct| < 15%` → `"stable"`
  - oposto → `"improving"`
- Anexar `trend` a cada `criticalIssue`, `moneyLeak` e ao bloco executivo (campo `accountTrend`).
- Quando `trend === "deteriorating"`, elevar `priority`/`urgency` (`now`), adicionar marcador `🔻 Em deterioração` no título.
- Quando `trend === "stable"` num problema crônico, marcar `📊 Crônico` e suavizar urgência.

**Rules (`v3-growth-intelligence-rules.ts`):** regra nova "TENDÊNCIA OBRIGATÓRIA" — cada item do top 3 deve citar tendência se disponível ("ROAS caiu de 7,2× para 5,1× nas últimas 2 semanas"); se `trend === null` (conta nova, <28d de histórico), declarar limitação.

**UI:** badge de tendência (▲ melhorando / ▬ estável / 🔻 piorando) em `DiagnosisMoneyLeakGrid` e `DiagnosisProblemsMasterDetail`. Sem mudança de layout.

**Testes:** nova fixture de trends; classifyTrend cobrindo as 3 saídas + edge case `previous = 0`.

---

## Item 3 — Modo "conta saudável"

**Detecção (`derive-account-score.ts` / `derive-growth-intelligence.ts`):** flag `accountIsHealthy` true se TODAS:
- `executiveImpact.gapMonthlyBrl ≤ 10% da receita mensal` **e**
- ROAS conta ≥ ROAS de referência do nicho **e**
- nenhum `criticalIssue` com `severity === "critical"` **e**
- score ≥ 80.

**Comportamento quando `accountIsHealthy`:**
- `buildMoneyLeaks` retorna no máximo 1 item (o maior); resto vira "oportunidades de teto", não "vazamentos".
- `buildGrowthOpportunities` muda enquadramento: títulos viram "Para chegar ao top 5% do nicho falta X" em vez de "Recuperar eficiência".
- `executiveConclusion.isHealthy = true`, `firstDecisionIfIHired` foca em escala (não em correção).
- `executiveImpact.headlinePt` muda template para "Conta no top 20% do nicho — teto disponível de R$X/mês".

**Rules:** seção nova "MODO CONTA SAUDÁVEL" — proibido inventar 3 problemas; mínimo de 1 e máximo de 2 itens no top; linguagem de consultoria de escala, não resgate.

**UI:** `DiagnosisPresentationHero` já tem `scoreTier === "high"` — adicionar variante de eyebrow "Acima do nicho" quando `accountIsHealthy`. `DiagnosisMoneyLeakGrid` esconde título "Quanto está na mesa" e usa "Teto de crescimento" quando `accountIsHealthy`.

**Testes:** fixture de conta saudável (ROAS 9×, gap 4%) → 1 leak, headline de teto, sem urgência "now".

---

## Fora de escopo (combinado)
- Item 4 (Audience Overlap real via API).
- Item 5 (sequência de e-mails D+1/D+5/D+10).

## Validação
- `bunx vitest run supabase/functions/_shared/diagnosis`
- Reprocessar 2 diagnósticos reais via `scripts/ops-reprocess-diagnosis.mjs`: um com poucas compras (esperar `low`/linguagem suave) e um com ROAS acima do nicho (esperar modo saudável).
- Conferir que a soma dos leaks continua batendo com `gapMonthlyFormatted` (regra #4 anti-template existente).
