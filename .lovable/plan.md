## Problema

Nas duas capturas, os cards de destaque (roxo/primary) e o card branco de bullets estão **sem padding interno** — o texto encosta na borda. Isso acontece porque `landingPrimaryCalloutClass` e `landingSurfaceCardClass` em `src/lib/landing-ui.ts` definem só borda/fundo, sem `p-*`. Cada uso adiciona padding ad-hoc — e nesses dois lugares esqueceram.

Também vou aproveitar para equilibrar visualmente:

## Ajustes

**1. `src/lib/landing-ui.ts`**
- Adicionar `p-6 sm:p-7` como padding padrão em `landingSurfaceCardClass`.
- Adicionar `p-6 sm:p-8` como padding padrão em `landingPrimaryCalloutClass`.
- Auditar usos existentes (Included, Qualification, FinalCta, Testimonial, GestaoTrafegoHero form card) para remover paddings duplicados que agora ficariam somados.

**2. `src/components/gestao-trafego/GestaoTrafegoIncluded.tsx`**
- O card de bullets fica com espaçamento respirado.
- O callout de garantia (coluna direita) fica alinhado verticalmente no topo com o card de bullets (mesma altura visual) via `h-full` no callout ou `items-start` no grid.

**3. `src/components/gestao-trafego/GestaoTrafegoFinalCta.tsx`**
- Callout com padding padrão + reforço vertical (`py-10 sm:py-12` extra) para o bloco final ter presença.
- Manter o botão centralizado com `sm:max-w-sm` que já colocamos.

## Fora de escopo

- Não mexer em cor, tipografia, copy, nem no header/hero.
- Não mexer em outras landings (Agency Opus, Diagnóstico) — vou checar se o mesmo token é usado lá e, se for, manter o comportamento visual com override pontual apenas se aparecer regressão. Se preferir, faço o padding só no gestao-trafego (classe nova) sem tocar no token compartilhado — me avisa.

## Verificação

- Playwright: screenshot desktop + mobile de `/gestao-trafego` focando nas duas seções afetadas.
- Conferir visualmente `/gestao-checkout` e `/` (landing diagnóstico) para garantir que o padding novo não quebrou nada.
