## Diagnóstico atual

Hoje o relatório já cobre: semáforo de métricas, top 3 prioridades, breakdown por campanha, problemas, vazamentos, oportunidades, criativos, públicos, fundação, plano de ação com checklist, contexto de negócio com break-even, cenário de melhoria, limitações e CTA. P0–P4 fechados.

O gap que sobrou para "mais resultado" não é cobertura — é **convicção, ação e revisita**. O cliente lê, marca dois itens e some. Abaixo, as melhorias com maior alavanca, ranqueadas por impacto/esforço.

---

## P5 — Convicção (faz o cliente acreditar e agir)

**1. Simulador de impacto interativo** (alto impacto, médio esforço)
Sliders no card de cenário: "se eu reduzir CPA em X%", "se eu subir CTR para Y%", "se eu cortar Z% do budget que vaza". Cálculo em tempo real → ROAS projetado, receita extra/mês, payback. Usa `business_context` (ticket, margem, meta) que já temos. Transforma o número estático em decisão.

**2. Benchmarks por nicho** (alto impacto, médio esforço)
No card de métricas, ao lado de cada KPI, mostrar faixa de referência **do nicho informado** (ecommerce moda, infoproduto, serviço local etc.). Tabela hard-coded por categoria + fonte/disclaimer. Hoje o cliente vê "CTR 0,9%" e não sabe se é ruim; com benchmark vê "0,9% vs mediana 1,4% do seu segmento".

**3. Saúde criativa / fadiga** (alto impacto, baixo esforço)
Card de criativos hoje só lista best/worst. Adicionar:
- Score de fadiga por criativo (frequência × queda de CTR ao longo do tempo).
- Alerta: "3 dos 5 criativos ativos passaram do ponto de saturação."
Requer expandir o JSON gerado pelo `process-diagnosis` com `creativeHealth[]`.

---

## P6 — Ação (transforma plano em execução)

**4. Roadmap 30/60/90 dias** (médio impacto, baixo esforço)
Reagrupar o `actionPlan` em três colunas/abas por horizonte (semana 1–2 / mês 1 / mês 2–3) usando o campo `eta` que já existe. Cliente vê a sequência, não uma lista plana de 8 itens.

**5. "Como executar" embutido por item** (alto impacto, médio esforço)
Cada passo do plano abre um drawer com:
- Passo-a-passo (3–6 linhas) específico da Meta (ex.: "Ads Manager → Conjuntos → filtrar por freq > 3 → desativar").
- Templates prontos quando aplicável (copy, segmentação, estrutura de campanha).
Reduz a fricção entre "entendi" e "fiz".

**6. Anti-padrões — "O que NÃO fazer agora"** (médio impacto, baixo esforço)
Card curto com 3–5 armadilhas detectadas (ex.: "Não suba budget em campanhas com CPA acima da meta", "Não duplique criativo fatigado"). Previne danos enquanto o cliente age.

---

## P7 — Revisita e captura recorrente

**7. Re-diagnóstico com delta** (alto impacto, médio esforço)
Botão "Rodar novo diagnóstico" que reaproveita a conexão Meta. Quando existir um diagnóstico anterior do mesmo usuário, mostrar **delta por métrica** (ROAS +0,4, CPA −18%, score 47→62). Cria ciclo mensal e prova de valor.

**8. Resumo executivo enviável** (médio impacto, baixo esforço)
Botão "Enviar resumo para meu e-mail / WhatsApp" com 1 página: score, top 3, ROAS gap, próximo passo. Útil para o cliente compartilhar com sócio sem mandar o relatório inteiro.

**9. Link de leitura para sócio/agência** (baixo impacto, baixo esforço)
Variante do link atual com escopo "read-only" (sem CTA de gestão, sem formulário). Aumenta circulação interna.

---

## Recomendação de execução

Se for fazer só um lote agora, o trio com melhor retorno é:

- **#1 Simulador de impacto** — muda a percepção de valor do relatório inteiro.
- **#2 Benchmarks por nicho** — dá contexto ao semáforo, que hoje é absoluto.
- **#4 Roadmap 30/60/90** — empurra para execução sem reescrever conteúdo.

Tudo isso é frontend + pequenos ajustes no JSON do `process-diagnosis`. Sem mudanças de schema.

Quer que eu detalhe um destes três em plano de implementação, ou prefere outro recorte (ex.: ir para re-diagnóstico/delta, que abre a porta de receita recorrente)?
