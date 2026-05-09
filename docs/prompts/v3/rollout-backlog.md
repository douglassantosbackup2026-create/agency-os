# Backlog Técnico — Rollout Prompts IA v3

## Objetivo
Planejar implementação progressiva dos Prompts v3 sem regressão de runtime, com critérios de QA objetivos.

## Princípios
- Ordem de rollout: `04 -> 03 -> 02 -> 01 -> 05 -> 06`.
- Feature flags por prompt.
- Persistência dupla durante migração: texto legado + JSON v3.
- Compatibilidade retroativa com telas atuais.

## P0 — Prompt 04 (Alerta WhatsApp)

### Entregas técnicas
- Normalizar contrato do alerta IA (JSON v3).
- Implementar deduplicação 24h por `cliente + plataforma + gatilho`.
- Inibir envio quando não houver ação clara.
- Incluir `confidence`, `time_to_act`, `should_create_task`.

### Critérios de QA
- Não enviar alerta duplicado dentro da janela sem piora.
- JSON sempre parseável.
- Mensagem em até 10 segundos de leitura.
- Smoke test de horários fora de expediente reduzindo urgência (exceto cenário crítico real).

## P1 — Prompt 03 (Análise sob demanda)

### Entregas técnicas
- Capturar contexto do clique na rota de cliente.
- Persistir resposta com status, risco, oportunidade e ação recomendada.
- Adotar fallback seguro quando dados críticos estiverem ausentes.

### Critérios de QA
- Saída em <= 220 palavras.
- Inclusão obrigatória de `confianca`.
- Em cenário estável, texto explicita ausência de risco/oportunidade.

## P2 — Prompt 02 (Análise cliente final)

### Entregas técnicas
- Introduzir renderização de linguagem não técnica no fluxo de cliente.
- Forçar `pode_enviar_sem_revisao = false` por padrão.
- Campos sensíveis destacados para revisão humana.

### Critérios de QA
- Bloqueio de envio sem aprovação manual.
- Ausência de siglas técnicas proibidas.
- Mensagem curta e coerente com dados de negócio.

## P3 — Prompt 01 (Análise mensal gestor)

### Entregas técnicas
- Versionar `generate-report` para suportar 01 e 02.
- Persistir `principais_problemas` e `acoes_recomendadas` estruturadas.
- Adicionar bloco de acompanhamento de recomendações do mês anterior.

### Critérios de QA
- Status do mês coerente com regra de classificação.
- Evidências numéricas em problemas e ações.
- Sem afirmações causais sem suporte em dados.

## P4 — Prompt 05 (Pauta de reunião)

### Entregas técnicas
- Expandir `generate-meeting-report` com modos (`revisao_padrao|crise|upsell|renovacao`).
- Gerar versão curta de 5 minutos.
- Estruturar perguntas estratégicas por segmento.

### Critérios de QA
- Pauta entre 20 e 35 minutos.
- Modo da reunião refletido no tom e no roteiro.
- Resultado ruim tratado com transparência (sem ocultação).

## P5 — Prompt 06 (Inteligência concorrentes)

### Entregas técnicas
- Formalizar baseline semanal por concorrente.
- Classificar categoria dominante e pouco explorada.
- Adicionar confiança por longevidade de anúncio.

### Critérios de QA
- Sem inferir performance não observável.
- Quando sem mudança relevante, retorno explícito sem recomendação forçada.
- Ações recomendadas com rastreabilidade para dados de origem.

## QA transversal (todos os prompts)
- Ausência de dados inventados.
- JSON válido e parseável.
- Campos obrigatórios preenchidos.
- Limites de tamanho respeitados.
- Testes de snapshot com payloads fixos por prompt.
- Registro de versão de prompt e timestamp em persistência.
