Plano de implementação — página de captura de leads para gestão de tráfego pago (e-commerce)

Objetivo
Criar uma landing pública, otimizada para Meta Ads, que capta leads qualificados de e-commerces que investem mais de R$ 5.000/mês em Meta Ads e oferece a gestão de tráfego pago (R$ 1.997/mês). A conversão principal é o envio de contato, não o pagamento direto.

Público e posicionamento
- Público: donos de e-commerce físico, DTCs e heads de marketing de lojas que já gastam >R$ 5k/mês em Meta Ads.
- Proposta de valor: "pare de queimar dinheiro em campanhas que não escalam — receba uma proposta de gestão baseada em dados da sua conta".
- Tom: direto, técnico, focado em resultado e transparência (mesma voz do checkout de gestão e do diagnóstico).

URL e arquitetura
- Rota: `/gestao-trafego` (arquivo `src/routes/gestao-trafego.tsx`).
- Ação principal: formulário de lead acima da dobra, com CTA "Receber proposta de gestão".
- Pós-envio: mensagem de confirmação + botão para iniciar conversa no WhatsApp (`/gestao-trafego-obrigado` ou estado inline).
- Estrutura em 1 página longa, com navegação âncora interna, reutilizando o design system e componentes da landing de diagnóstico.

Seções da página
1. Header sticky — logo + link "Já tem diagnóstico?" + CTA principal.
2. Hero — headline com foco em e-commerce, subheadline, bullets de qualificação, formulário de lead (lado direito em desktop).
3. Prova social — prints de resultados (reutilizar `GestaoResultsGallery` com legendas por número).
4. Como funciona — 4 passos: preencher → análise da loja → proposta personalizada → início da gestão.
5. O que está incluído — lista de entregáveis do pacote R$ 1.997/mês (reutilizar `GESTAO_DELIVERABLES`).
6. Garantia/segurança — reutilizar o bloco de garantia do checkout.
7. FAQ — dúvidas sobre contrato, fidelidade, prazo de início, acessos necessários.
8. CTA final — repetir formulário curto ou botão para WhatsApp.
9. Footer leve — link para política, termos e diagnóstico R$ 37.

Formulário de lead
Campos obrigatórios e validados com Zod:
- Nome completo
- E-mail
- WhatsApp (máscara BR)
- Nome da loja
- Site da loja
- Investimento mensal aproximado em Meta Ads (select: <5k, 5k–15k, 15k–50k, 50k+)
- Principal desafio (textarea opcional)
- Checkbox de consentimento LGPD

Meta Pixel e rastreamento
- `PageView` automático via `MetaPixelTracker`.
- `ViewContent` do produto de gestão ao carregar a página.
- `Lead` ao enviar o formulário (deduplicado por `lead_gestao_${leadId}`).
- `CompleteRegistration` ao confirmar o envio.
- Parâmetros UTM: a página lê `utm_source`, `utm_campaign`, `utm_adset`, `utm_ad` e grava junto com o lead.

Backend
1. Nova tabela `public.ecommerce_leads` (Supabase migration):
   - id, name, email, phone, store_name, website, monthly_ad_budget_range, challenge, source, utm_source, utm_campaign, utm_adset, utm_ad, status, created_at, updated_at.
   - GRANT SELECT/INSERT para `authenticated` e `service_role`; GRANT ALL para `service_role`.
   - RLS: política de inserção anônima (somente campos do formulário) e leitura restrita ao admin.
2. Server function `submitEcommerceLead` em `src/lib/ecommerce-leads.functions.ts`:
   - Validação Zod server-side.
   - Insere o lead na tabela.
   - Dispara notificação interna (ex.: grava um evento na `diagnosis_handoff_events` ou envia WhatsApp para o operador).
   - Retorna `{ success: true, leadId }`.
3. Hook `useEcommerceLeadSubmit` para chamar a server function do formulário.

Admin / follow-up
- Nova aba "Leads E-commerce" na página `/platform-admin` (componente `PlatformEcommerceLeads`).
- Lista ordenada por `created_at` desc, com filtros por status e faixa de investimento.
- Ações: marcar como contactado, abrir WhatsApp, converter em cliente (linkar a `clients` futuramente).
- Notificação sonora/toast de novo lead pode ser implementada via realtime ou polling simples.

Reutilização de assets e componentes
- Copiar/adaptar: `src/components/gestao/GestaoCheckoutBlocks.tsx` (galeria, depoimento, garantia, operador).
- Criar novo content: `src/content/gestao-trafego.ts` (copy, FAQ, entregáveis).
- Criar componentes específicos em `src/components/gestao-trafego/`:
  - `GestaoTrafegoHeader.tsx`
  - `GestaoTrafegoHero.tsx` (com formulário)
  - `GestaoTrafegoHowItWorks.tsx`
  - `GestaoTrafegoFaq.tsx`
  - `GestaoTrafegoFinalCta.tsx`
- Rota de agradecimento: `src/routes/gestao-trafego-obrigado.tsx`.

SEO
- Title: "Gestão de Tráfego Meta Ads para E-commerce | Agency Opus"
- Description: "Receba uma proposta de gestão de tráfego pago para sua loja. Especialista em e-commerce com resultados comprovados."
- `og:title`, `og:description`, `og:type=website`.
- Sem `noindex` — a página deve ser indexada para anúncios e SEO.

Critérios de aceitação
- [ ] Formulário valida e persiste lead no Supabase.
- [ ] Pixel dispara `Lead` e `CompleteRegistration` no envio.
- [ ] Admin consegue visualizar e atualizar status dos leads.
- [ ] A página está responsiva e segue o design system existente.
- [ ] Rota de agradecimento oferece botão de WhatsApp e dispara `Contact` (se aplicável).

Próximos passos
Aprovar este plano para que eu crie a migration, a server function, a rota e os componentes.