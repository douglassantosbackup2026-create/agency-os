# Redesign página completa do diagnóstico (gatilho mental da dor)

Ficheiro: `src/routes/diagnostico.$diagnosisId.tsx` + `src/styles/diagnosis.css`

Reescrever copy e UI de TODAS as secções do relatório com o gatilho da dor — em cada bloco, primeiro nomear o custo concreto (dinheiro queimado, leads perdidos, tempo desperdiçado) e depois mostrar os dados/solução. Fechar com CTA de gestão como saída natural da dor acumulada ao longo do relatório.

## Estrutura nova da página

### 1. Header (hero do relatório)
- **Atual:** "Diagnóstico Meta Ads" + score + label + summary
- **Novo:** chip "Diagnóstico Meta Ads", título grande com o score, label, e abaixo uma frase de dor calibrada ao score:
  - score < 40: "A tua conta está a sangrar dinheiro todos os dias."
  - 40-69: "Estás a deixar resultados em cima da mesa — e nem sabes quanto."
  - ≥ 70: "Estás bem — mas há um tecto invisível a travar-te."
- Mostrar `summary` como subtítulo

### 2. Métricas
- Headline: "Onde o teu dinheiro está agora"
- Cada métrica em cartão próprio (não linha simples): nome, valor actual destacado, vs referência, badge de status colorida (vermelho/âmbar/verde) consoante `status`
- Linha de dor por baixo do grupo: "Cada métrica vermelha = euros que saem da conta sem voltar."

### 3. Problemas críticos
- Headline: "Os 3 buracos no teu funil"
- Cartões mais densos: ícone ⚠, título, descrição, badge de prioridade
- Sub-copy de dor antes da lista: "Cada um destes pontos está activo agora — enquanto lês isto."

### 4. Vazamentos de budget
- Headline: "Quanto estás a queimar por mês"
- Cada vazamento como cartão com cifrão grande à esquerda (ícone 💸), título, estimativa, hint
- Reforço: "Soma estimada acima — é o custo de não corrigir."

### 5. Oportunidades
- Headline: "O que estás a deixar na mesa"
- Cartões com ícone 📈, complexidade como badge
- Inverter framing: cada oportunidade descrita como perda actual, não ganho futuro

### 6. Criativos
- Headline: "Criativos: o que vende e o que queima"
- Duas colunas lado-a-lado (mobile: empilhadas): "✅ Melhor" verde / "❌ Pior" vermelho
- Recomendação como faixa destacada por baixo

### 7. Públicos
- Headline: "Estás a falar com as pessoas erradas?"
- Segmentação como parágrafo destacado, notas como lista com ícones

### 8. Estrutura da conta
- Headline: "A fundação está partida"
- Lista com ícones de check/x

### 9. Plano de acção
- Headline: "O caminho — se quisesses fazer sozinho"
- Timeline visual: número grande, acção, impacto, ETA
- Sub-copy de dor: "São X semanas de execução técnica. Tempo em que continuas a queimar budget."

### 10. Cenário de melhoria
- Headline: "Onde podes estar em 30 dias"
- Destacar valor com tipografia grande, confiança como badge

### 11. Gestão de tráfego (CTA final — clímax)
- Headline: "Cada dia parado custa-te dinheiro"
- Sub-headline: "O diagnóstico acima mostra exactamente onde estás a queimar budget. Enquanto não corriges, três coisas continuam a acontecer todos os dias:"
- 3 bullets de dor:
  - 🔥 Budget queimado em criativos e públicos errados
  - 📉 Leads que o concorrente apanha porque o teu CPA está acima do mercado
  - ⏰ Cada semana sozinho = mais um mês de resultados adiados
- Ponte: "Podes continuar a tentar sozinho — ou deixar a nossa equipa executar o plano em 7 dias."
- Form (mantido: nome da loja, site, instagram) com intro "Últimos 3 campos antes de começarmos:"
- CTA: "Parar de queimar budget — R$ 1.997"
- Microcopy: "Pagamento único · Sem mensalidade · Execução em 48h"
- Linha de prova: "Equipa certificada · Relatório semanal · Cancelas quando quiseres"

## UX / UI global

- Sistema de cores semântico em `diagnosis.css`:
  - vermelho/âmbar para dor, verde para ganho, azul neutro para info
  - badges de status (high/medium/low, bom/médio/mau) com cores consistentes
- Cartões com mais hierarquia: título grande, espaçamento generoso, divisores subtis
- Score do header: número gigante (~80px), barra de progresso colorida por baixo
- Secção "Gestão de tráfego": fundo destacado (gradiente quente subtil), borda âmbar em vez de azul, selo "Recomendado pela análise"
- Tipografia: aumentar peso/tamanho de headlines de secção; sub-headlines de dor em itálico ou cor de acento
- Responsivo: tudo continua a funcionar em mobile (grids colapsam para coluna única)
- Manter container e estrutura de `.diagnosis-funnel` / `.card` existentes; adicionar novas classes utilitárias (`.pain-line`, `.metric-card`, `.leak-card`, `.timeline-step`, `.cta-pain` etc.)

## Lógica preservada (sem alterações)

- Todos os hooks, fetch, tracking (`diagnosis-track`, `diagnosis-report`)
- Estados: link incompleto, processing, failed, sem analysis, managementPaid, gestaoCheckout=falha/pending
- Form validation e fluxo de checkout Mercado Pago
- Link WhatsApp pós-pagamento
- Rota, search params, meta robots noindex

## Fora de scope
- Backend, edge functions, schema
- Outras páginas (obrigado, gestao-obrigado, etc.)
