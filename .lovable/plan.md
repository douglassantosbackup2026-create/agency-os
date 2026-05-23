
# Análise do checkout de referência

Os elementos que fazem esse checkout converter muito:

1. **Barra de urgência no topo** ("PROMOÇÃO EXPIRA EM 47:59…") — timer regressivo cria escassez real.
2. **Branding + título do produto** logo abaixo, em uma faixa única e enxuta (sem header genérico de "Voltar").
3. **Resumo do pedido em destaque** com produto, valor e **Total grande em cor de marca** — o usuário sempre vê o que está comprando e por quanto.
4. **Card visual do produto** (mockup/ilustração) — humaniza o digital, reduz sensação de "estou pagando por nada".
5. **Lista de entregáveis com checks** ("Você vai receber:") — empilha valor percebido antes do formulário.
6. **Bloco de garantia + compra segura** dentro de um card destacado — quebra objeção de risco no momento da decisão.
7. **Selos de confiança** ("Acesso imediato", "Compra segura", "Garantia 7 dias") em chips horizontais.
8. **Formulário curto e progressivo**: Nome → E-mail → WhatsApp → CPF, um campo por linha, labels claras e microcopy explicando o porquê de cada campo sensível ("Use o mesmo e-mail…", "Obrigatório para emitir a cobrança…").
9. **Order bumps opcionais** (cards com checkbox "Adicione …") com preço riscado — aumenta ticket médio sem fricção.
10. **Seletor de pagamento como toggle grande** (Pix / Cartão) em vez de Tabs sutis.
11. **CTA contextual e específico** ("Gerar Pix e liberar meu acesso" / "Pagar com cartão e liberar meu acesso") — não um genérico "Pagar".
12. **Reasseguramento sob o CTA** ("Seu acesso será liberado após a confirmação do Pix").
13. **Rodapé de selos** repetindo segurança/garantia/suporte.
14. **Layout single-column, mobile-first**, sem distrações (sem nav, sem links externos).

# Plano de implementação

Escopo: apenas frontend (`src/routes/checkout.tsx` + 1–2 componentes auxiliares + tokens). **Sem mudanças em backend, banco, ou Edge Functions.** Order bumps ficam apenas visuais nesta primeira iteração (placeholder, sem alterar amount no servidor) — quando você quiser ativá-los de verdade, fazemos uma segunda rodada que mexe em `start-diagnosis-payment` para somar ao total.

## 1. Estrutura visual nova (substitui o layout atual)

```text
┌─ Barra de urgência (timer 30:00 regressivo, sessionStorage) ─┐
├─ Brand bar (logo + nome do produto) ────────────────────────┤
│                                                              │
│  Resumo do pedido            R$ 37,00                        │
│  Diagnóstico Meta Ads        Total destacado                 │
│                                                              │
│  [Card do produto com ícone/ilustração + nome + subtítulo]   │
│                                                              │
│  Diagnóstico Meta Ads                                        │
│  Você vai receber:                                           │
│  ✓ Auditoria completa da sua conta                           │
│  ✓ Plano de ação priorizado                                  │
│  ✓ … (lista vinda de constante)                              │
│                                                              │
│  ┌ Garantia 7 dias / Compra segura (card destacado) ┐        │
│                                                              │
│  [chips: Acesso imediato · Compra segura · Garantia 7 dias]  │
│                                                              │
│  Seus dados                                                  │
│  (Nome, E-mail, WhatsApp — um por linha)                     │
│                                                              │
│  Ofertas especiais (opcional)  ← order bumps visuais         │
│  [ ] Bump 1                                                  │
│  [ ] Bump 2                                                  │
│                                                              │
│  CPF                                                         │
│                                                              │
│  Pagamento  [ Pix ] [ Cartão ]   ← toggle grande             │
│  (form do método selecionado)                                │
│                                                              │
│  [ CTA: Gerar Pix e liberar meu acesso ]                     │
│  Reasseguramento sob o CTA                                   │
│                                                              │
│  Footer: Pagamento seguro · Acesso imediato · Garantia · Suporte
└──────────────────────────────────────────────────────────────┘
```

Largura máx. ~480px (single column mobile-first) — não os 3xl atuais.

## 2. Componentes a criar dentro de `src/routes/checkout.tsx`

- `UrgencyBar` — timer 30 min usando `sessionStorage` (`checkout_deadline`) para persistir entre reloads; quando zera, esconde a barra (não bloqueia compra).
- `OrderSummaryCard` — produto + total grande em cor primária.
- `ProductHeroCard` — ícone Lucide grande + título + tagline.
- `DeliverablesList` — array de strings → lista com `CircleCheck`.
- `GuaranteeCard` — bloco com 2 linhas (Garantia 7 dias, Compra segura).
- `TrustChips` — 3 chips horizontais.
- `PaymentMethodToggle` — substitui Tabs por dois `<button>` grandes lado a lado com ícones, estilo segmented.
- `OrderBumps` — 2 cards visuais com checkbox; estado local apenas (sem efeito no preço nesta versão; texto deixa claro que são "em breve" OU removemos se preferir).

Reaproveitar lógica existente (`useMercadoPago`, `apiStart`, `apiProcess`, `apiStatus`, `CardForm`, `PixForm`) — só muda envoltório visual e CTA copy.

## 3. Tokens de design (em `src/styles.css`)

Sem inventar paleta nova; usar tokens já existentes (`--primary`, `--card`, `--muted`). Acrescentar apenas:
- `--success` (para checks da lista) se não existir.
- gradiente sutil `--gradient-urgency` para a barra do topo (usa `--destructive` / `--primary`).

Tudo via tokens — zero cor hardcoded.

## 4. Copy de alta conversão

- CTA Pix: **"Gerar Pix e liberar meu acesso"**
- CTA Cartão: **"Pagar com cartão e liberar meu acesso"**
- Subtítulo do form: "Use o mesmo e-mail que você quer usar para receber o diagnóstico."
- Microcopy do CPF: "Obrigatório para emitir a cobrança no seu nome."
- Reasseguramento Pix: "Seu acesso será liberado em segundos após a confirmação do Pix."
- Reasseguramento cartão: "Acesso imediato após a aprovação."

## 5. Acessibilidade / responsividade

- Toggle de pagamento como `role="radiogroup"`.
- Timer com `aria-live="polite"` mas atualizando só a cada segundo.
- Mobile-first; quebra para 1 col em <640px, mantém 1 col em desktop (max-w ~480).

## 6. Fora do escopo desta iteração (faço depois se quiser)

- Order bumps somando no `amount_cents` do servidor (requer mudar `start-diagnosis-payment` e `process-diagnosis-payment`).
- Cupom de desconto.
- Parcelamento dinâmico do cartão (hoje é 1x fixo).
- Prova social (depoimentos) — só se você tiver textos reais.

Confirma que avanço com esse plano? Quer que eu **remova os order bumps** já que ainda não estão funcionais, ou **mantenho como visual "em breve"**?
