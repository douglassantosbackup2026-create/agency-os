# Redesign Premium — Diagnóstico Executivo Meta Ads

Substituir o layout atual de `src/routes/diagnostico.$diagnosisId.tsx` por uma experiência de consultoria executiva (McKinsey × Stripe × Linear × Vercel). Mantém toda a lógica de fetch/estado/CTAs/checkout/`s` token, só troca a camada de apresentação. Usa exclusivamente dados reais do `analysis` retornado pelo backend.

## Princípios de design

- **Tema dark premium**: fundo `oklch` quase-preto com sutil gradiente, superfícies em níveis (`surface-1/2/3`), bordas hairline (1px alpha), tipografia editorial (serif display para números/headlines, sans para texto), tracking apertado em títulos grandes.
- **Hierarquia executiva**: cada seção começa com um eyebrow numerado ("01 · Diagnóstico"), título grande, uma linha de subtítulo, e só depois a evidência. Muito whitespace.
- **Storytelling vertical**: usuário avança como num memorando executivo — Impacto → Maturidade → Vazamentos → Oportunidades → Benchmark → Gargalo → Melhor oportunidade → Plano → Projeção → CTA.
- **Sem dashboard**: nada de grids densos de gráficos. Números grandes, listas ranqueadas, tabelas tipográficas, barras finas, badges discretos. Animações: fade-up sutis no scroll, sem confetti.
- **Tokens novos** em `src/styles/diagnosis-premium.css`: paleta dark executiva (bg, surface, border, text-primary/secondary/muted, accent positivo/negativo, gold para destaque CTA). Tudo via CSS vars semânticas.

## Mapeamento dados reais → seções

| Seção | Fonte em `analysis` |
|---|---|
| Hero | `financialBalance` + `financialImpact.lossMonthlyFormatted` + `recovery*` + `storyExecutive` + top finding |
| Maturidade | `maturity` (level, label, pillars[]) + fallback `scoreExplanation.pillars` |
| Vazamentos | `financialImpact.wasteLines` + `budgetLeaks` + `leakByAxis` (ranking por `monthlyBrl`) |
| Oportunidades | `opportunities[]` + `growthIntelligenceDerived` |
| Benchmark | `benchmarkComparison.gaps[]` (current, reference, status, deltaLabel) |
| Gargalo principal | `topFindings[0]` ou `criticalIssues[0]` com maior `monthlyImpactBrl` |
| Melhor oportunidade | `opportunities[0]` (maior potencial) com narrativa de `chapterNarratives` |
| Plano | `actionPlan`/`prioritizedActions` agrupados por horizonte (0–7 / 8–30 / 31–90 via `buildRoadmapFromActionPlan`) |
| Projeção | `growthScenarios` (conservador/provável/agressivo) ou derivado de `recovery*` |
| CTA final | `mgmt` hook + `whatsappGestaoHref` (mantém comportamento atual) |

Onde campos faltarem: seção é omitida (não usar mocks), exceto fallbacks já existentes em `diagnosis-report-fallback.ts`.

## Arquitetura de componentes

Novo diretório `src/components/diagnosis-report/executive/`:

```text
ExecutiveLayout.tsx        shell dark + side TOC sticky + progress rail
ExecHero.tsx               headline impacto + 4 stat cards + gargalo/oportunidade + CTA
ExecMaturity.tsx           score 0–100 com ring + barras finas dos pilares
ExecLeaks.tsx              lista ranqueada expansível com impacto R$/mês
ExecOpportunities.tsx      grid de cards (potencial / dificuldade / prazo)
ExecBenchmark.tsx          tabela editorial com badges acima/na/abaixo
ExecBottleneck.tsx         seção full-bleed: problema → causa → consequência → solução
ExecBestOpportunity.tsx    case study layout (atual vs potencial vs ação)
ExecActionPlan.tsx         timeline horizontal 3 colunas (7/30/90 dias)
ExecProjection.tsx         simulador visual 4 cenários (hoje/conservador/provável/agressivo)
ExecCtaFinal.tsx           bloco premium dourado com 2 CTAs
```

Cada componente recebe só os pedaços do `analysis` que precisa (props tipadas com `DiagnosisAnalysis` partials).

## Mudanças em `diagnostico.$diagnosisId.tsx`

- Mantém todo o bloco de hooks, fetch, error/loading, gating de `management_status`, `useManagementCheckout`, `invokeDiagnosisFunction` etc.
- Remove o `DiagnosisReportShell` + cards atuais e renderiza `<ExecutiveLayout>` com as seções acima na ordem definida.
- Estados de loading/erro/pending ganham telas dark consistentes (skeleton editorial em vez do shell atual).
- Mantém suporte a `print` (cover) e `presentation` layout existentes — não altero esses fluxos.

## Estilo

- Novo arquivo `src/styles/diagnosis-executive.css` com tokens dark, tipografia (importa Instrument Serif + Inter via `@import`), utilitários `.exec-eyebrow`, `.exec-stat`, `.exec-rule`, `.exec-card`, animações `fade-up` com `prefers-reduced-motion` respeitado.
- `diagnosis-premium.css` antigo permanece para a versão `presentation`/print; novo CSS é importado só na rota.

## Fora do escopo

- Não toco em backend (`process-diagnosis`, prompts) — dados já existem.
- Não mexo em `/conectar`, checkout, ou rota `presentation`.
- Não adiciono dependências novas (uso Tailwind + CSS custom).

## Validação

Após implementar: navegar para um diagnóstico real no preview, conferir cada seção, verificar fallbacks quando campos opcionais faltam, checar responsivo mobile, e confirmar build TS limpa.
