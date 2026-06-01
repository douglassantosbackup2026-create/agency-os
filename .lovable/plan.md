## Problema

O relatório está fazendo duas inferências erradas no card "Sobreposição de Públicos":

1. **Decodifica `[GM]` e `[IN]`** como "Gestão Manual" e "Interesse/Inbound" — são apenas nomenclaturas internas da conta, sem esse significado.
2. **Afirma sobreposição de público** baseando-se no nome / quantidade de campanhas ativas, ignorando que cada campanha tem `objective` diferente (topo / meio / fundo de funil).

O prompt `diagnosis-ecommerce-v3` já tem a regra #7 proibindo decodificar nomenclaturas, mas não tem regra explícita sobre **quando** é legítimo afirmar sobreposição. O modelo continua escorregando.

## Mudanças propostas

Editar apenas `SYSTEM_PROMPT` em `supabase/functions/process-diagnosis/index.ts`. Sem alteração de schema, código TS, UI ou banco.

### 1. Reforçar a regra #7 (decodificação de nomes)

Tornar a proibição mais agressiva e explícita sobre o efeito em qualquer campo:

- Banir parafrasear o significado de prefixos/sufixos em **qualquer** campo (`summary`, `criticalIssues.description`, `audiencesSummary.*`, `actionPlan.action`, `structureNotes`, etc.).
- Permitido: citar o nome cru (rótulo opaco) ou agrupar por padrão sintático ("4 campanhas começam com `[GM]`"). Proibido: atribuir semântica ("provável Gestão Manual", "indica top/fundo de funil", "sugere estratégia X").
- Listar exemplos de violações típicas para o modelo evitar.

### 2. Nova regra — quando afirmar sobreposição de público

Adicionar bloco dedicado:

- Só afirmar sobreposição quando houver **evidência observada** em `facts_json`: reach rate < 50%, frequência ≥ 5, ou mesma `targeting`/`saved_audience_id`/interesses sobrepostos.
- **Campanhas com `objective` diferente** (ex.: `OUTCOME_AWARENESS` vs `OUTCOME_SALES`, `REACH` vs `CONVERSIONS`) **não constituem sobreposição** por padrão — são fases de funil distintas. Tratar como sinal contra, não a favor.
- Sem dado de targeting/saved audience nos facts, registrar a limitação em `dataLimitations` e **não** levantar a hipótese como problema crítico.
- Se levantar mesmo assim (ex.: reach rate baixo confirmado), descrever a evidência numérica concreta, sem inferir intenção a partir de nomes.

### 3. Bumpar versão do prompt

Atualizar `PROMPT_VERSION` para `diagnosis-ecommerce-v4` para invalidar cache / rastrear qual versão gerou cada relatório.

## Fora do escopo

- Schema do JSON de saída (mantém igual).
- Frontend (`diagnostico.$diagnosisId.tsx`) — apenas consome.
- Funções `diagnosis-report`, `diagnosis-context`, `process-diagnosis` normalização determinística.
- Migrations.

## Validação

- Após o deploy do edge function, rodar um novo diagnóstico na mesma conta e conferir o card de Públicos: não deve mais decodificar `[GM]`/`[IN]`, e só deve afirmar sobreposição com número observado (reach rate ou frequência).
- Diagnósticos antigos no banco mantêm o texto atual — apenas novos rodam com a v4.