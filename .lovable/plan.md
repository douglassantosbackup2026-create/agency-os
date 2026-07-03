## Problema

No mobile, o carrossel de resultados (`GestaoResultsGallery`) está estourando a largura da página, criando scroll horizontal.

Causa provável: o wrapper do `<Carousel>` usa `px-6 sm:px-10` para dar espaço às setas `CarouselPrevious/Next` (posicionadas em `left-0`/`right-0`), mas as setas ficam *dentro* desse mesmo padding, sobrepondo a imagem — e o `h-72 w-full` do container da imagem, combinado com o `basis-full` do slide, força uma largura maior que o viewport quando somada às margens do grid pai (`px-4` da section + `p-5` do card).

## Correção (apenas Tailwind, sem mudança de lógica)

Arquivo: `src/components/gestao/GestaoCheckoutBlocks.tsx`

1. **Remover padding lateral do `<Carousel>` no mobile** — trocar `className="mt-4 w-full px-6 sm:px-10"` por `className="mt-4 w-full sm:px-10"`. No mobile as setas ficam sobrepostas na imagem (com fundo semi-transparente); no desktop mantém o padding para separá-las.
2. **Garantir contenção**: adicionar `overflow-hidden` no wrapper externo do carrossel para blindar contra qualquer overflow residual de filhos.
3. **Reduzir o padding interno do card** no mobile — trocar `rounded-xl border bg-card p-5` do `<section aria-labelledby="gestao-results-title">` por `rounded-xl border bg-card p-3 sm:p-5`, dando mais espaço horizontal útil ao carrossel.
4. **Setas com fundo legível no mobile** — adicionar `bg-background/80 backdrop-blur` nas classes de `CarouselPrevious` e `CarouselNext` (via `className` no ponto de uso, não editar `carousel.tsx`), para permanecerem visíveis quando sobrepostas à imagem.
5. **Altura da imagem no mobile** — reduzir `h-72` para `h-64` para reduzir a área que gera pressão de largura em telas muito estreitas (mantém `sm:h-auto sm:aspect-[4/3]` no desktop).

## Escopo

- Somente `src/components/gestao/GestaoCheckoutBlocks.tsx`.
- Nenhuma alteração em conteúdo, dados, tracking ou lógica.
- Nenhuma alteração no componente base `carousel.tsx`.

## Resultado esperado

- Mobile: carrossel encaixa dentro da página, sem scroll horizontal; setas visíveis sobre a imagem; prints do Google Ads seguem legíveis (mantém `object-contain sm:object-cover` da última edição).
- Desktop: layout praticamente idêntico ao atual.
