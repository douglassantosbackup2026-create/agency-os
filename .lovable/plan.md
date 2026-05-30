# Patch cirúrgico v2 — `supabase/functions/process-diagnosis/index.ts`

Objetivo: aplicar o prompt v2 (com regras absolutas, benchmarks, `dataLimitations`) **preservando** todo o handler atual — cron-auth, batch, budget, `diagnosis_secrets`, telemetria, expiração de token, ordem de fallback de providers.

Apenas 4 edições cirúrgicas. **Nada do handler é tocado.**

## Edição 1 — `PROMPT_VERSION` (linha 7)

```ts
const PROMPT_VERSION = "diagnosis-ecommerce-v2";
```

## Edição 2 — `SYSTEM_PROMPT` (linhas 10-26)

Substituir pelo prompt v2 melhorado (combina o teu + os 5 ajustes da minha análise: locale/moeda, limites de array, métricas mínimas, lista de campos obrigatórios em `metrics`, instrução anti-truncamento):

```ts
const SYSTEM_PROMPT = `És um auditor sênior de Meta Ads especializado em e-commerce brasileiro, com foco em eficiência de verba e escalabilidade. Respondes APENAS em PT-BR e APENAS com JSON válido (sem markdown, sem texto fora do JSON). Valores monetários sempre em BRL (a menos que facts.account_insights indique outra moeda).

## REGRAS ABSOLUTAS
1. NUNCA inventes métricas, valores ou percentuais que não derivem diretamente de facts_json ou de benchmarks explicitamente rotulados como "referência típica de mercado".
2. NUNCA garantas ROAS, CPA ou resultado financeiro — usa sempre linguagem de estimativa ("potencial de", "estimativa de", "tipicamente", "pode chegar a").
3. Se um campo depender de dados ausentes (criativos por ad, insights por campanha, públicos detalhados), preenche com null ou string explicando a limitação — NUNCA com suposições apresentadas como fatos.
4. O score reflete apenas o observável. Dados insuficientes REDUZEM a confiança, não inflam o score.
5. Todo campo null por falta de dados deve aparecer em dataLimitations[].
6. Se facts_json parecer truncado ou malformado, regista em dataLimitations e ajusta o score em conformidade.

## BENCHMARKS BR E-COMMERCE (referência, nunca garantia)
- CTR feed/display: > 1,5% saudável; < 1% alerta
- CPM: < R$25 eficiente; > R$40 investigar
- CPC: < R$2,50 topo de funil; < R$5 fundo
- Frequência 30d: < 3,5 saudável; > 5 saturação
- ROAS viável: > 3x (varia por margem — não absoluto)
- Reach rate (reach/impressions): < 50% indica sobreposição

## PRIORIDADE DE PROBLEMAS (mais → menos crítico)
1. Verba desperdiçada (campanhas inativas com gasto, CPM absurdo)
2. Estrutura quebrada (sem conversão, pixel com problemas)
3. Saturação (frequência alta, reach baixo)
4. Criativos (CTR baixo, sem rotação)
5. Oportunidades de escala

## LIMITES DE OUTPUT
- metrics: SEMPRE inclui (se houver dados) — CTR, CPM, CPC, Frequência, Reach rate, ROAS estimado
- criticalIssues: 3 a 7 itens, ordenados por priority desc
- budgetLeaks: até 5
- opportunities: 3 a 5
- actionPlan: 5 a 8 passos, eta em dias ("3-5 dias", "1-2 semanas")
- structureNotes, audiencesSummary.notes: até 6 itens
- summary: 2-4 frases, direto ao ponto

Tom: direto, técnico mas legível por dono de e-commerce — sem jargão excessivo.

## SCHEMA DE SAÍDA (JSON estrito, todos os campos obrigatórios)
{
  "score": number,
  "scoreLabel": string,
  "summary": string,
  "metrics": [{ "name": string, "current": string, "reference": string, "status": "ok"|"warn"|"bad" }],
  "criticalIssues": [{ "title": string, "description": string, "priority": "high"|"medium"|"low" }],
  "budgetLeaks": [{ "title": string, "estimateNote": string, "hint": string }],
  "opportunities": [{ "title": string, "potentialNote": string, "complexity": "quick"|"medium"|"advanced" }],
  "creativesSummary": { "best": string|null, "worst": string|null, "recommendation": string },
  "audiencesSummary": { "segmentation": string, "notes": string[] },
  "structureNotes": string[],
  "actionPlan": [{ "step": number, "action": string, "impact": string, "eta": string }],
  "improvementScenario": { "note": string, "confidence": "high"|"medium"|"low" },
  "disclaimer": string,
  "dataLimitations": string[]
}

## RUBRICA DE SCORE
- 90-100: conta otimizada, métricas dentro dos benchmarks
- 70-89: boa base, ineficiências claras a corrigir
- 50-69: problemas significativos impactam resultado
- 30-49: estrutura comprometida, ação urgente
- 0-29: estado crítico

O disclaimer deve ser honesto sobre as limitações da análise face aos dados disponíveis.`;
```

## Edição 3 — `validateAnalysis` (linhas 39-43)

Substituir pelo validador robusto com defaults sensatos (mantém assinatura `boolean` para não mexer no orquestrador), e adicionar normalizador que preenche defaults in-place:

```ts
function validateAnalysis(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.score !== "number") return false;
  if (typeof o.summary !== "string") return false;
  if (!Array.isArray(o.criticalIssues)) return false;
  if (!Array.isArray(o.actionPlan)) return false;
  if (typeof o.disclaimer !== "string") return false;
  return true;
}

function normalizeAnalysis(obj: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(obj.dataLimitations)) obj.dataLimitations = [];
  if (!Array.isArray(obj.metrics)) obj.metrics = [];
  if (!Array.isArray(obj.budgetLeaks)) obj.budgetLeaks = [];
  if (!Array.isArray(obj.opportunities)) obj.opportunities = [];
  if (!Array.isArray(obj.structureNotes)) obj.structureNotes = [];

  if (typeof obj.scoreLabel !== "string") {
    const s = obj.score as number;
    obj.scoreLabel =
      s >= 90 ? "Excelente" : s >= 70 ? "Bom" : s >= 50 ? "Regular" : s >= 30 ? "Crítico" : "Emergência";
  }

  if (!obj.creativesSummary || typeof obj.creativesSummary !== "object") {
    obj.creativesSummary = {
      best: null,
      worst: null,
      recommendation: "Dados insuficientes para análise de criativos no nível de anúncio.",
    };
    (obj.dataLimitations as string[]).push("Criativos por anúncio não disponíveis nos dados desta versão.");
  }

  if (!obj.audiencesSummary || typeof obj.audiencesSummary !== "object") {
    obj.audiencesSummary = {
      segmentation: "Dados insuficientes para análise de públicos.",
      notes: [],
    };
    (obj.dataLimitations as string[]).push("Detalhamento de públicos por ad set não disponível.");
  }

  if (!obj.improvementScenario || typeof obj.improvementScenario !== "object") {
    obj.improvementScenario = {
      note: "Cenário de melhoria não calculado por dados insuficientes.",
      confidence: "low",
    };
  }

  return obj;
}
```

## Edição 4 — `runWithFallback` (linha 213)

Aplicar `normalizeAnalysis` logo após validação OK, antes de devolver:

```ts
const analysis = await p.run(facts);
const ms = Date.now() - t0;
if (!validateAnalysis(analysis)) {
  attempts.push({ provider: p.name, ok: false, ms, error: "validation_failed" });
  console.warn(`[process-diagnosis] ${p.name} validação falhou (${ms}ms)`);
  continue;
}
const normalized = normalizeAnalysis(analysis as Record<string, unknown>);
attempts.push({ provider: p.name, ok: true, ms });
console.log(`[process-diagnosis] ${p.name} OK (${ms}ms)`);
return { analysis: normalized, provider: p.name, attempts };
```

## Edição 5 (opcional, baixo risco) — enriquecer `fetchCampaigns`

Linha 84 — adicionar campos extra que o teu v2 propunha:

```ts
u.searchParams.set(
  "fields",
  "name,status,effective_status,objective,daily_budget,lifetime_budget",
);
```

Dá ao modelo objetivo + orçamento por campanha sem alterar contrato nem latência significativa.

---

## O que NÃO mudamos (de propósito)

| Mantido | Porquê |
|---|---|
| Handler `Deno.serve` completo | Cron-auth, batch, `cleanup_stale_diagnosis_processing`, budget, secrets, telemetria — tudo essencial |
| Contrato HTTP (sem `diagnosis_id` no body) | Cron envia POST simples; muda contrato = quebra cron |
| `diagnosis_secrets` para token Meta | Token cifrado em tabela, NUNCA no body |
| Tabela `diagnoses` para `status`/`failed_reason` | É lá que vive o status (v1 está correto; v2 que propuseste estava errado) |
| `extractJsonFromText` com remoção de ```json fences | Anthropic às vezes devolve com fence |
| Modelos default (`gpt-5`, `gemini-2.5-pro`, `claude-sonnet-4`) e `max_tokens: 8192` | Downgrade pioraria qualidade |
| Ordem de providers + telemetria de attempts | Já está bem |

## Migração de dados

Nenhuma. Reports antigos ficam com `prompt_version: v1`; novos com `v2`. Frontend renderiza ambos (campo `dataLimitations` é opcional na UI — ignorado se ausente).

## Verificação pós-implementação

1. Build TS limpo.
2. Disparar 1 diagnóstico de teste via UI normal.
3. Inspecionar `diagnosis_reports.analysis_json` — verificar presença de `dataLimitations` e `prompt_version: diagnosis-ecommerce-v2`.
4. Conferir logs do edge function para confirmar fallback chain inalterado.

---

**Confirmas que sigo com este patch (5 edições cirúrgicas, sem tocar no handler)?**