## Problema
Na `/gestao-trafego-checkout`, as imagens da galeria "Resultados reais" e o avatar do Douglas aparecem quebradas — só o ícone de imagem quebrada + texto do `alt` transbordando pelo card. Assets em `/__l5e/...` respondem 200 no dev, preview e domínio custom, então o defeito é de **renderização/layout** e não de rede: quando o `<img>` demora ou falha por qualquer motivo, o card colapsa porque não há container com dimensão fixa nem estado de fallback.

## Correção (somente frontend, sem mudar business logic)

### 1. `src/components/gestao/GestaoCheckoutBlocks.tsx` — `GestaoResultsGallery`
- Envolver cada `<img>` em um container com aspect-ratio fixo (`aspect-[4/3]`) e `overflow-hidden`, com `<img className="h-full w-full object-cover" width={800} height={600} onError={...} />`.
- Adicionar estado `erroredIndexes` (via `useState`) para, no `onError`, esconder o `<img>` e mostrar um placeholder discreto no lugar (ícone + "Print indisponível") — evita o `alt` gigante vazando pelo card.
- Trocar `loading="lazy"` para `loading="eager"` só no primeiro slide (para não piscar dentro do carrossel), manter lazy nos demais.
- Manter badge "META ADS/GOOGLE ADS" absoluto sobre o container (agora sempre com altura garantida).

### 2. `GestaoOperatorCard` no mesmo arquivo
- Trocar `<img h-12 w-12 rounded-full>` por um container `h-12 w-12 shrink-0 rounded-full overflow-hidden bg-muted` com `<img className="h-full w-full object-cover" width={96} height={96} onError={hide}>` e fallback com iniciais (`GESTAO_OPERATOR.initials`) quando falhar.

### 3. Sanidade de layout
- Confirmar que os cards do carrossel (`CarouselItem` com `basis-full md:basis-1/2 lg:basis-1/3`) ficam com altura consistente após o aspect-ratio (sem `h-auto` na imagem).
- Sem mudanças em `GestaoSocialProof`, `GestaoGuaranteeBlock` ou `GestaoNextSteps`.

### 4. Verificação
- Rodar a rota `/gestao-trafego-checkout` via Playwright headless com `?lead=` e `s=` mockados (ou apenas visitar `/gestao-trafego-obrigado`, onde a mesma galeria também aparece) e conferir por screenshot que:
  - Imagens carregam com proporção 4:3 uniforme.
  - Se uma URL falhar, aparece o placeholder e o texto do alt não vaza.
  - Avatar do Douglas mostra iniciais "DS" caso a foto falhe.

## Fora de escopo
- Não mexer no fluxo de checkout, Mercado Pago, edge functions ou schema.
- Não regenerar os assets em `src/assets/gestao-proof-*.png.asset.json` (as URLs estão saudáveis).
