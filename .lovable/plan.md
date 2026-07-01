## Objetivo

Transformar a seção "Resultados reais de contas que gerimos" (usada em `/gestao-trafego` e `/gestao-checkout`) de grid estático em carrossel navegável.

## Mudanças

**Arquivo:** `src/components/gestao/GestaoCheckoutBlocks.tsx` — componente `GestaoResultsGallery`

- Substituir o `<div className="grid grid-cols-1 md:grid-cols-3">` pelo `Carousel` do shadcn (`@/components/ui/carousel`, já disponível no projeto, baseado em Embla).
- Cada print vira um `<CarouselItem>` com largura responsiva:
  - Mobile: 1 item por vez (`basis-full`)
  - Tablet: 2 itens (`md:basis-1/2`)
  - Desktop: 3 itens (`lg:basis-1/3`)
- Adicionar setas `CarouselPrevious` / `CarouselNext` posicionadas nas laterais.
- Ativar `opts={{ align: "start", loop: true }}` para navegação circular.
- Manter o mesmo card interno (imagem, badge da plataforma, métrica, caption, nicho) — só muda o container.
- Preservar título, subtítulo e disclaimer legal já existentes.

## Impacto visual

- `/gestao-trafego` (seção "Prova social"): passa a mostrar os 5 prints em carrossel, com destaque visual maior por card e navegação por setas.
- `/gestao-checkout`: mesma mudança, mantendo consistência entre landing e checkout.

Nenhum outro arquivo precisa mudar; o conteúdo (`GESTAO_RESULT_PROOFS`) permanece igual.