# Melhorias de UX/UI — /gestao-trafego

Análise da landing atual (hero com formulário longo → qualificação → como funciona → o que inclui → prova social → FAQ → CTA final). O funil é sólido; o que falta é **hierarquia visual, redução de fricção no form e reforço de confiança acima da dobra**.

## Prioridade 1 — Hero e formulário (o que mais move conversão)

1. **Formulário em 2 etapas (progressive disclosure).**
   Hoje o usuário vê 7 campos + consent de cara. Isso intimida no mobile.
   - Etapa 1 (acima da dobra): apenas **WhatsApp + faixa de investimento**. CTA "Continuar".
   - Etapa 2: nome, e-mail, site/@, desafio, consent.
   - Barra de progresso fina no topo do card (1/2 → 2/2).

2. **Qualificação implícita no primeiro campo.**
   O select de investimento hoje já vem com `5k-15k` pré-selecionado — isso mascara leads fora do ICP. Trocar para placeholder ("Selecione") e, se `<5k`, mostrar mensagem gentil redirecionando para o diagnóstico de R$37 (sem bloquear, mas sinalizando encaixe melhor).

3. **Trust signals no card do form.**
   Adicionar logo faixinha abaixo do título do form: "🔒 Dados protegidos · ⚡ Resposta em 24h úteis · 🚫 Sem fidelidade". Hoje o `footnote` está solto na coluna da esquerda, longe do botão.

4. **Hero mais escaneável.**
   - Reduzir bullets de 6 → 4 (os 2 últimos — sem fidelidade e WhatsApp — viram badges pequenos abaixo do CTA).
   - Adicionar 1 linha de prova social micro logo abaixo do H1: "+X e-commerces gerenciados · ROAS médio Yx" (usar dados reais de `GESTAO_SOCIAL_PROOF`).

## Prioridade 2 — Prova social e credibilidade

5. **Subir a prova social para logo depois do hero** (antes de "Para quem é").
   Hoje ela aparece só na 5ª seção — o usuário decide se preenche o form muito antes disso. Um strip enxuto com 3 prints de ROAS + card do Douglas resolve.

6. **Depoimento em destaque.**
   `GESTAO_TESTIMONIAL` existe mas não é usado nesta landing. Colocar como blockquote grande entre "O que está incluído" e FAQ, com nome + loja + resultado numérico.

7. **Legenda das plataformas na galeria.**
   A `GestaoResultsGallery` mostra prints do Meta e explica em legenda que cobre outras plataformas — bom. Adicionar **logos** (Meta, Google, TikTok) em uma linha discreta no hero e/ou na seção de gestão, para o multi-plataforma ficar visual, não só textual.

## Prioridade 3 — Estrutura e navegação

8. **Sticky CTA no mobile.**
   Barra fixa no rodapé em telas <md com "Receber proposta" — o form fica muito longe depois que rola. Esconder quando o form estiver visível (IntersectionObserver).

9. **Âncora "Resultados" no header aponta para a seção certa.**
   Já aponta para `#prova` (correto), mas a seção não tem título visível. Adicionar H2 "Resultados reais de clientes" no topo do `GestaoTrafegoSocialProof` para reforçar quando o usuário chega via âncora.

10. **FAQ com acordeão em vez de lista aberta.**
    Verificar `GestaoTrafegoFaq` — se está tudo aberto, reduzir peso visual usando `<details>` nativo ou Accordion do shadcn. FAQ aberto empurra o CTA final para muito longe.

11. **"Como funciona" com ícone por etapa.**
    Hoje é só número em bolinha. Adicionar ícone lucide por passo (FileText → Search → FileCheck → Rocket) — dá ritmo visual e diferencia dos cards de "O que inclui".

## Prioridade 4 — Polimento

12. **Consent com link para /privacidade** (hoje é texto puro).
13. **Máscara de telefone com feedback em verde** quando válida (Check icon dentro do input).
14. **`autoComplete` correto** nos inputs (`name`, `email`, `tel`, `organization`, `url`) — melhora preenchimento no mobile.
15. **Loading state do botão** com skeleton no card inteiro pós-submit, não só texto "Enviando…".
16. **Dark mode do hero** — o gradient do H1 highlight (`text-primary`) precisa de checagem de contraste em dark; hoje pode ficar apagado.

## Fora de escopo (não mexer agora)

- Copy — já foi revisada nas últimas iterações.
- Preço/oferta — âncora R$37 vs R$1.997 já está definida.
- Integração de backend `ecommerce_leads` — funcionando.

## Como quero implementar

Sugiro fazer em 3 PRs pequenos, do mais impactante para o menos:

- **PR1 (form 2 etapas + trust signals + sticky mobile CTA)** — maior efeito em conversão.
- **PR2 (subir prova social, adicionar depoimento, logos de plataforma)** — reforço de credibilidade.
- **PR3 (FAQ acordeão, ícones em "Como funciona", polimento de inputs)** — polish.

Me confirma se quer que eu comece pelo PR1 ou se prefere que eu ataque algum ponto específico da lista primeiro (ex.: "só o sticky mobile e trust signals").
