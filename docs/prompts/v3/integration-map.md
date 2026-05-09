# Mapa de Integração — Prompts IA v3 (sem alteração de runtime)

## Escopo
Documento de referência para mapear prompt -> função/tela atual e lacunas de schema para rollout futuro.

## Mapeamento Prompt -> Produto Atual

### Prompt 01 / 02 — Análise mensal
- **Runtime atual**: `supabase/functions/generate-report/index.ts`
- **Superfície de UI**: `src/routes/_authenticated/reports.tsx`
- **Estado atual**: saída textual e dados brutos comparativos já existem.
- **Gap principal**: parser/normalizador para JSON v3 com campos de governança.

### Prompt 03 — Análise sob demanda
- **Runtime candidato**: ação `Analisar agora` em `src/routes/_authenticated/clients.$clientId.tsx`
- **Estado atual**: fluxo de insights existe, mas sem contrato JSON v3 explícito.
- **Gap principal**: contexto do clique + persistência estruturada da recomendação.

### Prompt 04 — Alerta WhatsApp
- **Runtime atual**: `supabase/functions/evaluate-alerts/index.ts`
- **Envio**: `supabase/functions/send-whatsapp/index.ts`
- **Estado atual**: gatilhos e envio já implementados.
- **Gap principal**: deduplicação robusta (`avoid_duplicate_until`), confiança e bloqueio por ação pendente.

### Prompt 05 — Pauta de reunião
- **Runtime atual**: `supabase/functions/generate-meeting-report/index.ts`
- **UI consumidora**: `src/routes/_authenticated/clients.$clientId.tsx`
- **Estado atual**: geração de pauta já existe em formato MVP.
- **Gap principal**: modos formais (`crise`, `upsell`, `renovacao`) + JSON v3.

### Prompt 06 — Inteligência competitiva
- **Runtime atual**: `supabase/functions/sync-competitors/index.ts`
- **UI consumidora**: `src/routes/_authenticated/competitors.tsx`
- **Estado atual**: snapshots e insights simulados já existem.
- **Gap principal**: baseline semanal formal e classificação por categoria com confiança por longevidade.

## Gaps de Schema (não aplicar agora)

## Campos transversais de governança
- `ai_output_text` (texto renderizável)
- `ai_output_json` (JSON parseável)
- `confianca` (`alta|media|baixa`)
- `requer_revisao_humana` (boolean)
- `status_envio` (`pendente_revisao|aprovado|enviado|descartado`)

## Gaps por domínio
- **alerts**: `avoid_duplicate_until`, `time_to_act`, `should_create_task`, `task_title`.
- **reports**: distinção formal de versão de prompt (`prompt_version`) e tipo de audiência (`gestor|cliente`).
- **meeting_reports**: `modo_reuniao`, `tom_recomendado`, `tempo_total_minutos`, `requer_preparacao_extra`.
- **competitor_snapshots**: `baseline_disponivel`, `categoria_dominante`, `categoria_pouco_explorada`, `mudancas_relevantes`.

## Compatibilidade e versionamento
- Introduzir versão de prompt por registro para permitir coexistência de saídas antigas e v3.
- Parser deve falhar com segurança: se JSON inválido, manter texto e marcar revisão humana.
- Não quebrar telas atuais durante fase de coexistência.
