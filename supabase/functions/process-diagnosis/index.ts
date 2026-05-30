import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertCronOrUser } from "../_shared/cron-auth.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { diagnosisAiBudgetExceeded } from "../_shared/ai-budget.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

const PROMPT_VERSION = "diagnosis-ecommerce-v2";
const AI_TIMEOUT_MS = 60_000;

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

function buildUserPrompt(facts: Record<string, unknown>): string {
  return `Dados normalizados (facts_json):\n${JSON.stringify(facts).slice(0, 120000)}`;
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = AI_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchAccountInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set(
    "fields",
    "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data?.[0] ?? {};
}

async function fetchCampaigns(
  actId: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/campaigns`);
  u.searchParams.set("fields", "name,status,effective_status,objective,daily_budget,lifetime_budget");
  u.searchParams.set("limit", "40");
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

// ── AI Providers ─────────────────────────────────────────────────────────────

async function callAnthropic(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");
  const model = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-4-20250514";

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(facts) }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  return extractJsonFromText(text);
}

async function callOpenAI(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5";

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(facts) },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  return extractJsonFromText(text);
}

async function callGemini(facts: Record<string, unknown>): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-pro";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPrompt(facts) }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return extractJsonFromText(text);
}

type ProviderName = "anthropic" | "openai" | "gemini";

const PROVIDERS: { name: ProviderName; run: (f: Record<string, unknown>) => Promise<unknown> }[] = [
  { name: "anthropic", run: callAnthropic },
  { name: "openai", run: callOpenAI },
  { name: "gemini", run: callGemini },
];

async function runWithFallback(
  facts: Record<string, unknown>,
): Promise<{ analysis: Record<string, unknown>; provider: ProviderName; attempts: unknown[] }> {
  const attempts: unknown[] = [];
  for (const p of PROVIDERS) {
    const t0 = Date.now();
    try {
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
    } catch (e) {
      const ms = Date.now() - t0;
      const err = String(e).slice(0, 300);
      attempts.push({ provider: p.name, ok: false, ms, error: err });
      console.warn(`[process-diagnosis] ${p.name} falhou (${ms}ms): ${err}`);
    }
  }
  throw new Error(`Todos os providers IA falharam: ${JSON.stringify(attempts)}`);
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const traceId = traceIdFromRequest(req);
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const sb = diagnosisServiceClient();
  const auth = await assertCronOrUser(req, sb);
  if (auth) return auth;

  const { data: cleaned } = await sb.rpc("cleanup_stale_diagnosis_processing", {
    p_stale_minutes: 30,
  });
  if (cleaned && Number(cleaned) > 0) {
    traceLog("process_diagnosis.stale_cleaned", { count: cleaned }, traceId);
  }

  const { data: rows } = await sb
    .from("diagnoses")
    .select("id, meta_ad_account_id, status")
    .eq("status", "processing")
    .limit(
      Math.max(
        1,
        Math.min(
          25,
          Number(Deno.env.get("PROCESS_DIAGNOSIS_BATCH_SIZE") ?? "10") || 10,
        ),
      ),
    );

  if (!rows?.length) return jsonResponse({ processed: 0 });

  let processed = 0;
  for (const row of rows) {
    const id = row.id as string;
    const actId = row.meta_ad_account_id as string | null;
    if (!actId) continue;

    const { data: sec } = await sb
      .from("diagnosis_secrets")
      .select("access_token, token_expires_at")
      .eq("diagnosis_id", id)
      .maybeSingle();
    const token = sec?.access_token as string | undefined;
    if (!token) {
      await sb
        .from("diagnoses")
        .update({ status: "failed", failed_reason: "Token Meta ausente" })
        .eq("id", id);
      continue;
    }

    const expiresAt = sec?.token_expires_at as string | null | undefined;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: "Token Meta expirado. Reconecta a conta Meta.",
        })
        .eq("id", id);
      continue;
    }

    const { data: rep } = await sb
      .from("diagnosis_reports")
      .select("facts_json, analysis_json")
      .eq("diagnosis_id", id)
      .maybeSingle();

    let factsForAnalysis = rep?.facts_json as Record<string, unknown> | null;
    const analysisExisting = rep?.analysis_json;

    try {
      if (!factsForAnalysis) {
        const account_insights = await fetchAccountInsights(actId, token);
        const campaigns = await fetchCampaigns(actId, token);
        const facts = {
          meta_ad_account_id: actId,
          date_preset: "last_30d",
          account_insights,
          campaigns_sample: campaigns.slice(0, 40),
          generated_at: new Date().toISOString(),
        };
        await sb.from("diagnosis_reports").upsert({
          diagnosis_id: id,
          facts_json: facts,
          prompt_version: PROMPT_VERSION,
          updated_at: new Date().toISOString(),
        });
        factsForAnalysis = facts as unknown as Record<string, unknown>;
      }

      if (!analysisExisting) {
        if (await diagnosisAiBudgetExceeded(sb, 15000)) {
          await sb
            .from("diagnoses")
            .update({
              status: "failed",
              failed_reason:
                "Orçamento diário de IA do diagnóstico atingido. Tente amanhã.",
            })
            .eq("id", id);
          continue;
        }
        const { analysis, provider, attempts } = await runWithFallback(factsForAnalysis);
        const usageAgency = Deno.env.get("DIAGNOSIS_AI_AGENCY_ID")?.trim();
        if (usageAgency) {
          await sb.from("ai_usage_events").insert({
            agency_id: usageAgency,
            day: new Date().toISOString().slice(0, 10),
            function_name: "process-diagnosis",
            prompt_tokens: 12000,
            completion_tokens: 3000,
            estimated_cost_usd: 0.00525,
          });
        }
        const analysisWithMeta = {
          ...analysis,
          __meta: {
            provider,
            attempts,
            generated_at: new Date().toISOString(),
            prompt_version: PROMPT_VERSION,
          },
        };
        await sb
          .from("diagnosis_reports")
          .update({
            analysis_json: analysisWithMeta,
            prompt_version: PROMPT_VERSION,
            updated_at: new Date().toISOString(),
          })
          .eq("diagnosis_id", id);
      }

      await sb
        .from("diagnoses")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      processed++;
    } catch (e) {
      console.error(e);
      await sb
        .from("diagnoses")
        .update({
          status: "failed",
          failed_reason: String(e).slice(0, 500),
        })
        .eq("id", id);
    }
  }

  traceLog("process_diagnosis.done", { processed }, traceId);
  return jsonResponse({ processed });
});
