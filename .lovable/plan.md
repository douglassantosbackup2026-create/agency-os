## O quê

Adicionar uma galeria com 3 prints reais do Gerenciador Meta no checkout `/gestao-checkout`, com legenda destacando o número-chave de cada um. Posição: no final da página, logo após o bloco de pagamento e antes do link "Voltar ao relatório" (a página não tem FAQ — esse é o "final" funcional).

Observação: o checkout vive em `src/routes/gestao-checkout.tsx`. O arquivo legacy `diagnostico-meta/src/pages/DiagnosticoPage.tsx` não é tocado.

## Passos

### 1. Subir os 3 prints como assets CDN
Via `lovable-assets create` a partir de `/mnt/user-uploads/`:
- `gestao-proof-1.png` → print do total R$ 2.720.057,57 / ROAS 15,59
- `gestao-proof-2.png` → print do total R$ 4.463.616,78 / ROAS 32,57
- `gestao-proof-3.png` → print com 278 compras / ROAS 10,79 / R$ 383.962,41

Pointers gravados em `src/assets/gestao-proof-{1,2,3}.png.asset.json`. Nenhum binário no repo.

### 2. Catalogar legendas em `src/content/gestao-checkout.ts`
Novo export `GESTAO_RESULT_PROOFS`, ex.:
```ts
export const GESTAO_RESULT_PROOFS = [
  { src: proof1.url, alt: "...", metric: "ROAS 15,59×", caption: "R$ 2,72 milhões em vendas — período de 6 meses" },
  { src: proof2.url, alt: "...", metric: "ROAS 32,57×", caption: "R$ 4,46 milhões em vendas — operação escalada" },
  { src: proof3.url, alt: "...", metric: "ROAS 10,79×", caption: "278 compras · R$ 383 mil em vendas" },
];
```

### 3. Novo componente `GestaoResultsGallery` em `src/components/gestao/GestaoCheckoutBlocks.tsx`
- Título: "Resultados reais de contas que gerimos"
- Subtítulo curto: "Prints do Gerenciador de Anúncios Meta — clientes ativos"
- Grid responsivo: 1 col mobile, 3 cols `md+`
- Cada card: imagem (`object-cover`, `border`, `rounded-lg`, `loading="lazy"`), badge da métrica em destaque (cor `text-success`/`text-primary`), legenda curta
- Microcopy de rodapé: "Resultados variam por nicho, oferta e investimento."

### 4. Inserir no fim de `gestao-checkout.tsx`
Adicionar `<GestaoResultsGallery />` entre o parágrafo de `gestaoUrgencyText()` (linha ~478) e o `<div className="mt-6 text-center">` do link "Voltar ao relatório" (linha ~482). Import junto com os outros blocos de `GestaoCheckoutBlocks`.

## Fora de escopo
- Não mexer no checkout de R$ 37 nem na landing.
- Não alterar copy do depoimento da Marina nem do bloco do operador.
- Sem carrossel/JS — grid estático é suficiente para 3 prints.
