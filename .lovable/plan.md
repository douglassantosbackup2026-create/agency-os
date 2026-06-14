
# Plano — deixar a copy da home fluida

Objetivo: manter o conteúdo (oferta, prova, garantia) e ajustar **só texto** em `src/content/diagnosis-landing.ts` para a leitura fluir de cima até o CTA final sem repetição, sem caps lock excessivo e com transições claras entre seções.

## O que está travando a fluidez hoje

1. **Repetição da promessa central** ("perdendo dinheiro", "EXATAMENTE onde", "~5 minutos", "R$ 37", "sem pegadinha") aparece em hero, what-is, how-it-works, final-cta e FAQ com quase as mesmas palavras. O leitor sente que está lendo a mesma frase 4 vezes.
2. **CAPS LOCK em excesso**: títulos de módulo, passos do "como funciona" e bullets do "para quem" estão todos em maiúsculas. Quebra ritmo de leitura e parece grito.
3. **Hero sobrecarregado**: eyebrow + headline + subheadline + priceLine + 2 supportingLines + 3 trustBadges + 3 heroStats antes do scroll. São 5 blocos de texto competindo. Falta hierarquia.
4. **Sem ponte entre seções**: cada bloco começa do zero ("O que é", "Para quem é", "O que faz", "Como funciona"). Não há frase de transição que conecte a dor levantada no hero com a solução nas seções seguintes.
5. **"O que faz" lista 9 módulos com título + descrição + exemplo cada** — é o trecho mais pesado da página e quebra o fluxo bem no meio. Hoje funciona como spec sheet, não como narrativa.
6. **Voz oscila** entre formal ("auditoria técnica cirúrgica") e coloquial ("não é guru", "spoiler: não vai ser", "faz sentido ou não faz?"). Escolher um registro.
7. **Final CTA repete o hero quase literal** (mesma headline reformulada, mesmos 4 trust badges, mesmo preço). Deveria fechar com algo novo: urgência ou síntese.
8. **Números soltos**: "R$ 30 milhões", "5 anos", "~5 minutos", "R$ 37", "7 dias", "9 módulos", "15+ critérios", "90 dias", "5.000/mês" aparecem espalhados sem hierarquia. Fluidez melhora quando se escolhem 3 âncoras numéricas e o resto vira contexto.

## Mudanças propostas (todas em `src/content/diagnosis-landing.ts`)

### A. Hero enxuto
- `headline`: manter (é a âncora da página).
- `subheadline`: cortar "em cerca de 5 minutos" (já está no badge + heroStats).
- `supportingLines`: reduzir para 1 linha unindo as duas atuais ("Análise técnica com IA, feita por quem já gerenciou R$ 30 milhões em tráfego pago").
- `trustBadges`: remover "Resultado em ~5 minutos" (duplica heroStats).

### B. Tirar CAPS das listas
Converter para Sentence case e usar **negrito** só na palavra-chave:
- `whatItDoesSection.modules[*].title`
- `howItWorksSection.steps[*].title`
- `forWhoSection.forYou` / `notForYou` (primeiras palavras)
- `finalCta.outcomes`
Mantém CAPS apenas em: headline do hero (já é convenção), nome do autor.

### C. Frases-ponte entre seções (campo novo `bridge` opcional, renderizado como parágrafo curto antes do título)
- Antes de `whatIsSection`: "Antes de você gastar mais um real, entenda o que vai receber."
- Antes de `forWhoSection`: "Mas isso não serve para todo mundo."
- Antes de `whatItDoesSection`: "Quando serve, o que entra no relatório é isso:"
- Antes de `howItWorksSection`: "O processo é curto."
- Antes de `finalCtaSection`: "Resumindo."

### D. "O que faz" mais leve
- Reduzir cada `description` para 1 frase (máx ~140 chars).
- Mover `example` para um campo `proof` opcional que só aparece nos 3 módulos mais impactantes (1, 3 e 9). Os outros 6 ficam só título + descrição curta.
- Trocar `subtitle` "9 módulos" por "uma análise em 9 frentes — todas no mesmo relatório".

### E. Voz consistente
Padronizar em registro **direto-profissional** (mantém o "você", corta gírias):
- `authorSection.paragraphs`: remover "Não sou guru de Instagram prometendo milagres" e "Não é feeling".
- `guaranteeSection`: remover "(spoiler: não vai ser)".
- `forWhoSection.importantCalloutBody`: remover "Faz sentido ou não faz?".

### F. Final CTA com fechamento novo
- `title` + `subtitle`: trocar por algo que sintetize, não que repita ("Você já tem os números. Falta só ver o que eles dizem.").
- `paragraphs`: reduzir de 5 para 2 (a desconfiança + a oferta).
- `trustLines`: cortar para 2 ("Garantia de 7 dias" + "Pagamento seguro Mercado Pago"), o resto já foi dito.

### G. Hierarquia numérica
Escolher 3 âncoras que se repetem com propósito: **R$ 37**, **~5 minutos**, **R$ 30M gerenciados**. Remover menções secundárias soltas ("15+ critérios", "90 dias", "80% automatizado") do corpo da landing — manter só no FAQ se relevante.

## Fora de escopo
- Sem mudanças em componentes, layout, estilos ou lógica.
- Sem mudanças em SEO meta (`seoDefaults`) — copy já está OK lá.
- Sem mexer no mock do relatório nem em números do `reportPreviewDemo`.

## Entregável
Um único PR editando `src/content/diagnosis-landing.ts` com as alterações A–G. Se um componente precisar de um campo novo (`bridge`, `proof`), incluo a mudança mínima do componente correspondente para renderizá-lo.

## Pergunta antes de implementar
Quer que eu aplique **tudo** (A–G) ou prefere começar só pelo hero + final CTA (A + F + G), que são as duas mudanças com maior impacto percebido em ~10 min de leitura?
