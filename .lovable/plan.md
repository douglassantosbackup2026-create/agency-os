# Plano — Reestruturar /gestao-trafego inspirado no Grupo Moon

## Objetivo
Adicionar autoridade e melhorar hierarquia da landing, incorporando o que funciona bem na referência do Grupo Moon, respeitando duas restrições que você deu:
- **Sem imagens das marcas por enquanto** — começamos com cards de nome + nicho e evoluímos depois.
- **Sem case com resultado por marca específica** — mantemos os prints atuais anonimizados como estão.

## Mudanças estruturais

### 1. Nova seção "Lojas que escalamos" (nome + nicho)
Posição: **depois de `GestaoTrafegoPlatforms`, antes de `GestaoTrafegoSocialProof`** — a autoridade das marcas aparece cedo, antes dos prints de ROAS. Fica assim: Hero → Plataformas → **Marcas** → Prova (ROAS + depoimento) → resto.

Formato:
- Título: "Lojas que já passaram pela nossa gestão"
- Subtítulo: "E-commerces que confiaram na operação de mídia paga."
- Grid de 6 cards (3 col desktop / 2 tablet / 1 mobile), cada card com ícone `Store`, nome grande e nicho abaixo.
- Nichos default (você ajusta depois):
  - Mixed — Moda feminina
  - Fillity — Moda íntima
  - La Rouge — Beleza
  - Paula Ferber — Acessórios
  - Carolina Etz — Casa & decoração
  - Linea — Moda
- Nota de rodapé pequena: "Trabalho realizado como gestor no Grupo Moon."

### 2. Reformatar "Para quem é / Não é" no estilo problemas numerados
Inspirado no bloco "Você reconhece algum desses problemas?" do Grupo Moon.

Substitui o `GestaoTrafegoQualification` atual por 2 blocos:
- **"Você reconhece algum desses problemas?"** — 5 dores numeradas (01…05), fundo escuro, número verde à esquerda, texto branco. Ex.: "01 ROAS despencou nos últimos meses", "02 CPM não para de subir", "03 Escala trava em X mil/mês", "04 Criativos morrem em dias", "05 Sem visibilidade da conta".
- **"Este trabalho é pra quem" / "Não é pra quem"** — mantém, mais compacto, abaixo das dores.

### 3. Foto grande do Douglas (bloco dedicado)
Substituir o `GestaoOperatorCard` pequeno atual por um bloco full-width com foto grande (esquerda) + bullets de credencial (direita), estilo referência.
- Bullets já existentes em `GESTAO_OPERATOR.credentialLine` viram lista.
- Se não tiver foto, deixamos placeholder com iniciais em card grande.

### 4. Ajustar "Mais resultados" (`GestaoTrafegoMoreResultsCta`)
Como você não quer case por marca, mantemos o bloco atual (CTA de conversa), só reforçando com texto tipo "Cada operação é analisada individualmente — a proposta que você recebe é feita para o seu caso."

## Ordem final da página
1. Header
2. Hero (form)
3. Plataformas
4. **Lojas que escalamos** (novo)
5. Prova social (galeria ROAS + depoimento)
6. **Foto grande + credenciais Douglas** (novo, substitui card pequeno)
7. **Problemas numerados** (novo, substitui parte de qualification)
8. Para quem é / Não é (compacto)
9. Como funciona
10. Incluso + garantia
11. Mais resultados (CTA)
12. FAQ
13. CTA final

## Arquivos afetados
- `src/content/gestao-trafego.ts` — adicionar `clientsSection`, `problemsSection`, ajustar `qualificationSection`.
- `src/components/gestao-trafego/GestaoTrafegoClients.tsx` — novo.
- `src/components/gestao-trafego/GestaoTrafegoProblems.tsx` — novo (dores numeradas, fundo escuro).
- `src/components/gestao-trafego/GestaoTrafegoOperator.tsx` — novo (foto grande + credenciais).
- `src/components/gestao-trafego/GestaoTrafegoSocialProof.tsx` — remover `GestaoOperatorCard` daqui (vai pro bloco dedicado).
- `src/components/gestao-trafego/GestaoTrafegoQualification.tsx` — enxugar (só forYou/notForYou compacto).
- `src/components/gestao-trafego/index.ts` — exportar novos.
- `src/routes/gestao-trafego.tsx` — nova ordem.

## Fora do escopo (por decisão sua)
- Não vamos usar imagens das marcas nem case detalhado por marca.
- Não mexemos em Pixel, formulário, admin, webhooks ou pricing.
- Não copiamos duas ofertas lado a lado (Grupo Moon tem 2 produtos, você tem 1).

## O que precisa ser confirmado antes de codar
1. **Nichos das marcas** — os que sugeri servem ou você quer trocar algum?
2. **Foto do Douglas** — tem alguma disponível para o bloco grande? Se não, uso o placeholder de iniciais.
3. **Nota "Trabalho realizado como gestor no Grupo Moon"** — ok exibir essa atribuição publicamente? Pergunto porque você mencionou que agora está captando clientes pra você, e isso muda como a autoria dos cases é apresentada legalmente/eticamente.