## Ajuste de copy: funil de gestão de tráfego para e-commerce que quer escalar

### Objetivo
Reescrever a copy do funil `/gestao-trafego` → `/gestao-checkout` → obrigado com tom **agressivo de escala**, deixando claro que o produto é para lojas que já investem em mídia paga e querem crescer de forma estruturada, sem perder rentabilidade.

### Escopo
- **Landing** `/gestao-trafego`: hero, bullets, prova social, problemas, qualificação, CTA final, SEO.
- **Checkout** `/gestao-checkout`: headline/tagline do produto, deliverables, depoimento, next steps, copy do operador.
- **Obrigado da landing** `/gestao-trafego-obrigado`: título, corpo e CTA de WhatsApp.
- **Obrigado do checkout** `/gestao-obrigado`: título, copy de confirmação e próximos passos.

### Mudanças propostas

#### 1. `/gestao-trafego` — conteúdo em `src/content/gestao-trafego.ts`

**Hero**
- **eyebrow**: de "Gestão de Tráfego Pago para e-commerce" para "Gestão de tráfego pago para e-commerce que quer escalar".
- **headline**: de "Pare de queimar dinheiro em mídia paga." para "Escale sua loja sem queimar dinheiro em mídia paga.".
- **headlineHighlight**: de "queimar dinheiro" para "Escale sua loja".
- **subheadline**: manter a proposta, mas reforçar escala: "Gestão de tráfego pago sob medida para e-commerces que já investem mais de R$ 5.000/mês em Meta, Google, TikTok e outras plataformas e querem escalar com ROAS, estrutura e execução.".
- **microProof**: reforçar escala: "+R$ 30 milhões gerenciados · cases escalando de 5k para 50k+ de verba mantendo ROAS".
- **bullets**: trocar para bullets de escala:
  1. "Diagnóstico técnico da sua estrutura de campanhas antes de escalar"
  2. "Gestão diária de Meta, Google, TikTok e demais plataformas ativas"
  3. "Otimização de ROAS, CPA e criativos para escalar a verba sem perder rentabilidade"
  4. "Relatório semanal e canal direto com o gestor no WhatsApp"
- **cta**: manter "Receber proposta de gestão".

**Formulário**
- **title**: de "Solicite uma proposta para sua loja" para "Solicite uma proposta para escalar sua loja".
- **subtitle**: de "Preencha em 1 minuto. Douglas analisa sua operação e responde com a proposta." para "Preencha em 1 minuto. Douglas analisa sua operação e responde com um plano de escala.".
- **challenge placeholder**: de "Ex.: ROAS do Meta caiu, Google não escala, TikTok com CPA alto…" para "Ex.: ROAS caiu ao escalar, Google trava, TikTok com CPA alto, falta estrutura para dobrar a verba…".
- **budgetHint.low**: atualizar valor de R$ 1.997 para R$ 4.997 (já está 4.997 no preço real, mas o hint está desatualizado).
- **success**: título "Proposta solicitada", corpo "Recebemos seus dados. Douglas vai analisar sua operação e responder em até 24h úteis com uma proposta de escala.".

**Como funciona**
- **title**: de "De lead à operação no ar em poucos dias" para "De lead à operação escalando em poucos dias".
- **step 3 description**: "Plano de ação, investimento, prazo de início e projeção de escala nos primeiros 30 dias.".
- **step 4 description**: "Acesso, briefing, metas e as primeiras otimizações para escala em até 5 dias úteis.".

**Qualificação**
- **title**: de "Feito para um perfil específico de e-commerce" para "Feito para e-commerce que quer escalar com tráfego pago".
- **forYou**: adicionar "Quer escalar a verba de mídia paga mantendo ou melhorando o ROAS".
- **notForYou**: manter, mas ajustar a última para "Quem não tem pelo menos R$ 5.000/mês de verba de mídia — a gestão não compensa nessa escala".

**Problemas**
- **title**: manter "Você reconhece algum desses problemas?".
- **items**: trocar para gargalos de escala:
  1. "ROAS cai toda vez que tenta aumentar a verba"
  2. "CPM sobe e come a margem quando escala campanhas"
  3. "Faturamento trava no mesmo teto há meses"
  4. "Criativos morrem rápido e não há processo para repor em escala"
  5. "Sem visibilidade real do que acontece dentro da conta quando a verba cresce"

**CTA final**
- **title**: de "Antes de investir mais um real em mídia, olhe pra sua conta com quem entende de estrutura, não só de criativo." para "Antes de jogar mais dinheiro na mídia, estruture a conta para escalar. A gente cuida da execução.".
- **body**: de "Preencha o formulário e receba uma proposta de gestão de mídia paga (Meta, Google, TikTok e outras) feita para a sua operação — sem compromisso." para "Preencha o formulário e receba uma proposta de gestão focada em escalar sua operação (Meta, Google, TikTok e outras) — sem compromisso.".

**SEO**
- **title**: "Gestão de Tráfego Pago para E-commerce que Quer Escalar | Agency Opus".
- **description**: "Gestão de mídia paga para e-commerce que investe R$ 5k+/mês e quer escalar: Meta, Google, TikTok com um único gestor. Receba uma proposta de escala.".

#### 2. `/gestao-checkout` — conteúdo em `src/content/gestao-checkout.ts`

- **GESTAO_PRODUCT_TAGLINE**: de "Execução diária de Meta, Google, TikTok e demais canais — um único gestor especializado" para "Execução diária de Meta, Google, TikTok e demais canais — gestão para escalar com ROAS.".
- **GESTAO_DELIVERABLES**: reforçar escala em cada item:
  - "Gestão integrada de Meta, Google, TikTok e demais plataformas para escalar a verba"
  - "Implementação das correções prioritárias que travam a escala"
  - "Gestão diária de campanhas, criativos e públicos em cada canal"
  - "Otimização contínua de ROAS, CPA e estrutura de conta para escala"
  - "Testes A/B de criativos e ofertas com critério de escala"
  - "Relatórios de performance semanais e alinhamento de crescimento"
  - "Canal direto com o gestor (WhatsApp) para decisões rápidas"
- **GESTAO_TESTIMONIAL**: manter a estrutura, mas trocar quote para algo de escala, ex.: "Dobramos a verba de mídia em 90 dias e o ROAS subiu. O Douglas estruturou a conta para escalar, não só para rodar." — manter autor e métrica atuais ou ajustar papel para "CEO — moda feminina em escala".
- **GESTAO_OPERATOR.credentialLine**: manter já ajustado (sem Ex-Ogilvy), mas adicionar foco em escala: "Com passagem por operações de e-commerce de alto ticket · +R$ 30 milhões gerenciados em escala · 5 anos focados em e-commerce".
- **GESTAO_NEXT_STEPS**: manter, mas trocar o último para "Campanhas no ar e primeiras otimizações de escala em até 5 dias úteis".

#### 3. `/gestao-trafego-obrigado` — `src/routes/gestao-trafego-obrigado.tsx`
- **title meta**: "Proposta de escala solicitada — Gestão de Tráfego".
- **mensagem de WhatsApp**: de "Olá! Preenchi a proposta de gestão de tráfego no site e quero conversar sobre a minha operação." para "Olá! Preenchi a proposta de gestão de tráfego no site e quero conversar sobre como escalar a minha operação.".

#### 4. `/gestao-obrigado` — `src/routes/gestao-obrigado.tsx`
- **h1**: de "Gestão de tráfego" para "Gestão de tráfego para escala".
- **corpo de confirmação**: "1ª mensalidade confirmada para o pedido ligado ao seu diagnóstico. Próximo passo: preencha o formulário de onboarding para começarmos a estruturar a escala da sua operação.".
- **botão de onboarding**: de "Preencher onboarding (5 min)" para "Preencher onboarding de escala (5 min)".

### O que não muda
- Layout, componentes, cores, tipografia, imagens, preço (R$ 4.997), formulário, lógica de validação, pixels, SEO técnico (canonical, robots), fluxos de pagamento.
- Nenhuma alteração em backend, banco de dados ou migrations.

### Validação
- Verificar visualmente a landing em preview após ajustes.
- Rodar `bun run build` ou `tsgo` para garantir que não há erros de TypeScript após alterações de texto.
- Verificar se strings com ` ` (nbsp) em nomes de marca permanecem intactas.
