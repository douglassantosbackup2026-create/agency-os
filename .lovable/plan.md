## Plano: ancoragem de preço "de ~~R$ 199,90~~ por R$ 37"

Aplicar o preço-âncora em todos os pontos da landing do diagnóstico, com o valor antigo riscado.

### Constantes novas em `src/content/diagnosis-landing.ts`
- `PRICE_ANCHOR_LABEL = "R$ 199,90"`
- `PRICE_LABEL` continua `"R$ 37"`
- `PRICE_DISPLAY_HTML = 'de <s>R$ 199,90</s> por R$ 37'` (componentes usam JSX)
- `PRICE_DISPLAY_TEXT = "de R$ 199,90 por R$ 37"` (textos planos, SEO, alt)

### Substituições

**1. Header (`diagnosis-landing-header.tsx`)**
Botão "R$ 37" vira:
```
de <s class="opacity-70 text-xs">R$ 199,90</s> por R$ 37
```

**2. `src/content/diagnosis-landing.ts` — strings textuais**
Trocar para `PRICE_DISPLAY_TEXT` ("de R$ 199,90 por R$ 37") em:
- `priceLine` (hero)
- `stickyCtaLabel` → `Analisar · de R$ 199,90 por R$ 37`
- `qualificationCta` (linha 237)
- `comparisonCard.title` (linha 344) → `Você paga de R$ 199,90 por R$ 37`
- `guaranteeText` (linha 468)
- `finalCtaSubline` (linha 511)
- `finalCtaButton` (linha 516) → `Pagar de R$ 199,90 por R$ 37`
- `ctaPrimary` (linha 529) → `Analisar minha conta por de R$ 199,90 por R$ 37` → ajustar para `Analisar minha conta — de R$ 199,90 por R$ 37`
- FAQ (linhas 248, 497, 502): substituir "R$ 37" cru por "de R$ 199,90 por R$ 37" mantendo a frase fluida
- SEO `title` (546): `Diagnóstico Meta Ads para E-commerce — Onde você está perdendo dinheiro | de R$ 199,90 por R$ 37`
- SEO `description` (548): `... Por R$ 37 (de R$ 199,90). Pagamento seguro.`

**3. Componentes com renderização visual com riscado**
Onde aparece em destaque como preço (não dentro de frase corrida), renderizar com `<span>de <s>R$ 199,90</s> por R$ 37</span>`:
- Header (item 1)
- `diagnosis-report-preview.tsx` botão `ANALISAR MINHA CONTA — ${PRICE_LABEL}` → usa novo helper JSX `<PriceDisplay/>` ou string `PRICE_DISPLAY_TEXT`
- hero `priceLine`

Demais ocorrências em parágrafos longos (FAQ, garantia, comparativo) usam o texto plano sem riscado para não quebrar leitura.

### Fora do escopo (não alterar)
- `src/lib/meta-pixel.ts` `value: 37` (preço real pago, métrica de evento)
- `src/routes/checkout.tsx` `DEFAULT_AMOUNT_CENTS = 3700` (valor cobrado)
- Lógica de pagamento Mercado Pago

### Riscos
- O `stickyCtaLabel` mobile fica longo ("Analisar · de R$ 199,90 por R$ 37") — pode quebrar em telas pequenas. Mitigação: encurtar para `de R$ 199 por R$ 37 — Analisar` no mobile via classe truncate.
- SEO title pode passar de 60 chars. Vou usar versão curta: `Diagnóstico Meta Ads | de R$ 199,90 por R$ 37` (~50 chars).