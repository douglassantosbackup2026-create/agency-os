## Problema

No carrossel de provas (`GestaoResultsGallery`), as imagens usam `aspect-[4/3]` + `object-cover`. Os prints do Google Ads são mais largos e têm o valor de conversão no topo/lateral — o `object-cover` corta justamente essa parte no mobile, então o número da conversão não aparece.

Além disso, no mobile o carrossel usa `basis-full` com padding lateral `px-8`, o que aperta o card e agrava o corte.

## Ajustes (apenas visual, no arquivo `src/components/gestao/GestaoCheckoutBlocks.tsx`)

1. **Trocar `object-cover` por `object-contain`** no `<img>` das provas, mantendo `bg-muted` para preencher letterbox. Assim o print inteiro aparece — inclusive o valor de conversão dos Google Ads.
2. **Aumentar a altura no mobile** usando `aspect-[4/3]` só a partir de `sm:`, e no mobile usar `h-64` (ou `aspect-square`) para dar espaço vertical suficiente para o print completo.
3. **Reduzir o padding lateral do carrossel no mobile** de `px-8` para `px-6` (mantendo `sm:px-10`) para o card ganhar largura útil, e afastar os botões `CarouselPrevious/Next` com `left-0`/`right-0` já existentes (sem sobreposição na imagem).
4. Sem mudanças de conteúdo, dados ou lógica — só classes Tailwind no bloco `<figure>` / `<Carousel>`.

## Resultado esperado

- Mobile: prints do Google Ads mostram o valor de conversão inteiro (sem corte).
- Desktop: layout praticamente inalterado (aspect 4:3 continua a partir de `sm:`).