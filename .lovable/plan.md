# Plano — Revisão de copy e estrutura da /gestao-trafego

Objetivo: aplicar as mudanças de copy que você enviou, remover a repetição do depoimento da Marina, simplificar o funil (sem menção ao diagnóstico R$37) e tornar as provas mais defensáveis.

## 1. Remover "Diagnóstico R$37" do funil desta página
- `GestaoTrafegoHeader.tsx`: remover o link `Diagnóstico R$37` (desktop e menu mobile).
- `content/gestao-trafego.ts` (form.budgetHint.low): reescrever o nudge para não empurrar pro diagnóstico. Vira algo tipo: "Abaixo de R$ 5.000/mês a gestão de R$ 1.997 não compensa — você pode continuar mesmo assim, mas provavelmente vamos recomendar esperar ganhar escala antes."
- FAQ: remover a pergunta "Preciso fazer o diagnóstico de R$37 antes?" e substituir por "Preciso pagar alguma coisa antes de receber a proposta?" com a resposta que você escreveu.

## 2. Depoimento da Marina só 1x
Hoje o depoimento aparece em 3 lugares:
- Hero (via `GestaoTrafegoSocialProof` → micro prova) — só números, ok, mantém.
- `GestaoTrafegoSocialProof` (bloco `GestaoSocialProof`) — **mantém aqui, junto dos prints**.
- `GestaoTrafegoTestimonial` (bloco dedicado entre Included e FAQ) — **remover** e substituir por um bloco "Quer ver mais resultados como esse? Fale com a gente" apontando pro formulário (CTA secundário, sem repetir a citação).

Ação: deletar uso de `GestaoTrafegoTestimonial` em `routes/gestao-trafego.tsx` e criar um pequeno bloco `GestaoTrafegoMoreResultsCta` (ou reaproveitar padrão do FinalCta em versão compacta).

## 3. Prova / Resultados — subtítulo + disclaimer + nicho
Em `GestaoResultsGallery` (`components/gestao/GestaoCheckoutBlocks.tsx`):
- Título: "Resultados reais de contas que gerimos".
- Subtítulo: "Prints do Gerenciador Meta — a gestão cobre também Google, TikTok e outras plataformas ativas na sua loja."
- Cada card: adicionar campo `nicho` na legenda (placeholder: "moda feminina", "beleza", "casa" — você me confirma os nichos reais, ou deixo como "e-commerce" genérico até você passar).
- Rodapé da galeria: disclaimer novo — "Resultados variam por nicho, oferta, ticket médio e verba investida. Os números acima refletem contas específicas, não uma média geral."

## 4. Headline do hero (mais específica)
`content/gestao-trafego.ts` hero:
- Headline: manter "Pare de queimar dinheiro em mídia paga" **ou** trocar por versão mais orientada a estrutura (ex.: "Antes de investir mais um real em mídia, olhe pra sua conta com quem entende de estrutura, não só de criativo."). Vou aplicar a nova como headline principal e mover a antiga para subheadline curto — **preciso confirmar** (ver pergunta no fim).

## 5. Micro prova social do hero
Manter só números: "+R$ 30 milhões gerenciados · cases com ROAS 10×+ em contas ativas" — trocar "ROAS médio 10×+" (que soa como média geral) por "cases com ROAS 10×+".

## 6. Qualification — "Não é para quem"
`qualificationSection.notForYou`: adicionar a 4ª bala "Quem não tem pelo menos R$ 5.000/mês de verba de mídia — o investimento na gestão não compensa nessa escala".

## 7. Included — pequenos ajustes de clareza
`GESTAO_DELIVERABLES` em `content/gestao-checkout.ts`: revisar bullets para bater com a lista que você mandou (gestão integrada Meta/Google/TikTok, implementação das correções da análise inicial, gestão diária, otimização de ROAS/CPA, testes A/B, relatórios semanais, canal direto WhatsApp). Impacto: essa mudança também aparece no `/gestao-checkout` (mesmo array) — quero confirmar se tudo bem propagar lá também (é o mesmo produto, então deveria bater).

## 8. Como funciona
`howItWorksSection.steps` já está muito próximo do que você escreveu; ajusto passo 2 ("Avaliamos estrutura de campanhas, criativos e números — sem compromisso.") e passo 3 ("Plano de ação, investimento, prazo de início e o que esperar nos primeiros 30 dias.").

## 9. FAQ
- Remover pergunta do diagnóstico R$37.
- Adicionar "Preciso pagar alguma coisa antes de receber a proposta?" com resposta que você escreveu.
- Reescrever "Vocês garantem ROAS?" com a versão honesta+vendedora que você mandou.
- Manter as outras (tempo, contrato, plataformas, acessos).

## 10. CTA final
`finalCta`: título "Antes de investir mais um real em mídia, olhe pra sua conta com quem entende de estrutura, não só de criativo." + subtítulo e CTA que você mandou.

---

## Arquivos afetados
- `src/content/gestao-trafego.ts` (hero, form.budgetHint, qualification, howItWorks, faq, finalCta)
- `src/content/gestao-checkout.ts` (GESTAO_DELIVERABLES e GESTAO_RESULT_PROOFS legends/disclaimer) — impacto colateral em `/gestao-checkout`
- `src/components/gestao-trafego/GestaoTrafegoHeader.tsx` (remover link diagnóstico)
- `src/components/gestao/GestaoCheckoutBlocks.tsx` (galeria: subtítulo + disclaimer + nichos)
- `src/routes/gestao-trafego.tsx` (remover `GestaoTrafegoTestimonial`, inserir bloco "mais resultados")
- Novo: `src/components/gestao-trafego/GestaoTrafegoMoreResultsCta.tsx` (opcional, ou faço inline)
- Deletar: `src/components/gestao-trafego/GestaoTrafegoTestimonial.tsx`

## Fora do escopo
Não vou mexer em lógica de submit do form, integração Meta Pixel, admin ou webhooks — só copy, ordem e um componente novo simples.

## Preciso confirmar antes de codar
1. **Nicho dos 3 cases de ROAS** (15,59× / 32,57× / 10,79×) — quais são? Se não souber agora, deixo como "e-commerce" genérico.
2. **Headline do hero** — troco por "Antes de investir mais um real em mídia…" (sua versão do CTA final vira também a headline principal) ou mantenho "Pare de queimar dinheiro em mídia paga"?
3. **GESTAO_DELIVERABLES é compartilhado com /gestao-checkout** — ok propagar as pequenas melhorias de copy dos bullets nos dois lugares?
