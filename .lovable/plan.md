## Objetivo
Ampliar o posicionamento da Gestão de Tráfego: hoje a copy é toda focada em Meta Ads. Passar a comunicar gestão de tráfego pago em todas as mídias relevantes para e-commerce (Meta, Google, TikTok, Pinterest etc.), sem descaracterizar a especialização.

## Escopo (só copy + microcomponentes)
Alterações restritas a conteúdo e labels. Nenhuma mudança em backend, schema, webhooks, preços ou fluxo de checkout.

## Arquivos afetados

**1. `src/content/gestao-trafego.ts` (landing de captação de leads)**
- Hero eyebrow: "Gestão de Tráfego Meta Ads para e-commerce" → "Gestão de Tráfego Pago para e-commerce".
- Subheadline: trocar "mais de R$ 5.000/mês em Meta Ads" por "mais de R$ 5.000/mês em mídia paga (Meta, Google, TikTok e outras)".
- Bullets: generalizar "campanhas, criativos e públicos" para incluir múltiplas plataformas; manter foco em ROAS e execução.
- `form.fields.budget.label`: "Quanto investe por mês em Meta Ads?" → "Quanto investe por mês em mídia paga?".
- `form.fields.challenge.placeholder`: incluir exemplos de Google/TikTok além de Meta.
- Qualification: trocar "campanhas rodando" (implícito Meta) por "campanhas rodando em pelo menos uma plataforma paga".
- FAQ: atualizar pergunta de acessos para citar Google Ads, TikTok Ads Manager, GA4 além do BM/Pixel.
- SEO title/description: "Gestão de Tráfego Pago (Meta, Google, TikTok) para E-commerce".
- `finalCta.body`: substituir "Meta Ads" por "mídia paga".

**2. `src/content/gestao-checkout.ts` (checkout R$1.997 existente)**
- `GESTAO_PRODUCT_NAME`: "Gestão de Tráfego Meta Ads" → "Gestão de Tráfego Pago".
- `GESTAO_DELIVERABLES`: generalizar itens que dizem "campanhas/criativos" para deixar claro que cobre múltiplas plataformas; adicionar um item específico "Gestão integrada de Meta, Google e outras plataformas conforme a operação".
- `GESTAO_OPERATOR.credentialLine`: já cita "Meta e Google Ads" — manter.
- Nota: o `MANAGEMENT_MP_ITEM_TITLE` do edge function `create-management-checkout` já usa "Gestão de tráfego Meta / Google" — sugerir atualizar env var para "Gestão de tráfego pago" (documentar, não alterar código).

**3. `src/components/gestao-trafego/*` e `src/routes/gestao-trafego.tsx`**
- Ajustar qualquer string hard-coded que ainda diga "Meta Ads" (checar `GestaoTrafegoHero`, `GestaoTrafegoFinalCta`, header). Substituir por "mídia paga" / "tráfego pago" preservando menções a Meta quando forem exemplo específico.
- `trackMetaViewContent` `content_name`: manter "Gestão de Tráfego E-commerce Landing" (sem "Meta Ads" na string atual, ok).

**4. Prova social (mantém como está)**
- Os prints continuam sendo do Meta — vamos legendar como "Resultados em Meta Ads (exemplos reais de clientes)" para dar transparência de que a prova visível é Meta, mas o serviço cobre outras mídias.

**5. Diagnóstico e checkout de R$37**
- Fora de escopo. O diagnóstico continua sendo especificamente Meta Ads (é o produto de entrada). Só a Gestão passa a ser multi-mídia.

## Positioning final
- Título de mercado: "Gestão de Tráfego Pago para E-commerce — Meta, Google, TikTok e outras".
- Mensagem central: um único gestor cuidando de toda a operação de mídia paga da loja, sem terceirizar por canal.
- Diagnóstico (R$37) segue como porta de entrada focado em Meta Ads (não muda).

## Fora deste plano
- Preço, checkout, webhooks, tabelas Supabase, admin, Pixel, CAPI: sem alteração.
- Não vamos criar landing separada por canal; é uma landing única de gestão multi-plataforma.

## Critério de aceite
- Nenhuma frase da landing e do checkout de gestão implica que atendemos só Meta Ads.
- Formulário de lead pergunta investimento em mídia paga (não só Meta).
- SEO/OG refletem o novo posicionamento.
- Prints de resultado ficam legendados como exemplos Meta, sem enganar sobre o escopo do serviço.