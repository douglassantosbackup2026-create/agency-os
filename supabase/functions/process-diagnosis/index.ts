import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertCronOrUser } from "../_shared/cron-auth.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { diagnosisAiBudgetExceeded } from "../_shared/ai-budget.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

const PROMPT_VERSION = "diagnosis-ecommerce-v4";
const AI_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `És um auditor sênior de Meta Ads especializado em e-commerce brasileiro, com foco em eficiência de verba e escalabilidade. Respondes APENAS em PT-BR e APENAS com JSON válido (sem markdown, sem texto fora do JSON). Valores monetários sempre em BRL (a menos que facts.account_insights indique outra moeda).

## REGRAS ABSOLUTAS
1. NUNCA inventes métricas, valores ou percentuais que não derivem diretamente de facts_json ou de benchmarks explicitamente rotulados como "referência típica de mercado".
2. NUNCA garantas ROAS, CPA ou resultado financeiro — usa sempre linguagem de estimativa ("potencial de", "estimativa de", "tipicamente", "pode chegar a").
3. Se um campo depender de dados ausentes (criativos por ad, insights por campanha, públicos detalhados), preenche com null ou string explicando a limitação — NUNCA com suposições apresentadas como fatos.
4. O score reflete apenas o observável. Dados insuficientes REDUZEM a confiança, não inflam o score.
5. Todo campo null por falta de dados deve aparecer em dataLimitations[].
6. Se facts_json parecer truncado ou malformado, regista em dataLimitations e ajusta o score em conformidade.
7. NUNCA interpretes, decodifiques ou especules sobre o significado de nomenclaturas/tags/prefixos/sufixos em nomes de campanhas, conjuntos ou anúncios (ex.: [GM], [IN], [TOF], [BOF], [LAL], [INT], códigos internos da agência). Não assumas que [GM] significa "Gestão Manual", [IN] significa "Interesse/Inbound" etc. Essas convenções são internas e desconhecidas. Trata nomes como rótulos opacos — só comenta sobre nomenclatura se houver inconsistência óbvia de padronização (ex.: metade das campanhas sem prefixo nenhum), nunca atribuindo significado.

## BENCHMARKS BR E-COMMERCE (referência, nunca garantia)
- CTR feed/display: > 1,2% saudável (ok); 0,8%–1,2% atenção (warn); < 0,8% alerta (bad)
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
- metrics: SEMPRE inclui (mesmo que estimado a partir de dados parciais) — ROAS (OBRIGATÓRIO, sempre primeiro item da lista), CPA, CTR, CPM, CPC, Frequência, Reach rate. Se faltar dado para ROAS, calcula como receita/gasto do período disponível; se não houver receita rastreada, marca current como "sem tracking" e status "bad" com referência "> 3x".
- criticalIssues: 3 a 7 itens, ordenados por priority desc. SEMPRE que facts.campaigns_insights existir, usa esses dados (gasto, ROAS, CTR, frequência por campanha) para apontar campanhas específicas com problemas — ex.: "Campanha X concentra 38% do gasto com ROAS 0,9x".
- budgetLeaks: até 5. Se houver campanhas com ROAS < 1 ou alta frequência em facts.campaigns_insights, deve aparecer aqui com o nome da campanha (rótulo opaco, sem interpretar prefixos).
- opportunities: 3 a 5
- actionPlan: 5 a 8 passos, eta em dias ("3-5 dias", "1-2 semanas")
- structureNotes, audiencesSummary.notes: até 6 itens
- summary: 2-4 frases, direto ao ponto

## DADOS DISPONÍVEIS EM facts_json
- account_insights: agregado da conta (30d)
- campaigns_sample: lista de campanhas com status/objetivo/orçamento
- campaigns_insights: insights por campanha (30d) — gasto, ROAS, CTR, CPM, frequência, ações. Usa para identificar campanhas com problemas específicos.
- ads_insights_top: top 25 anúncios por gasto (30d). O servidor calcula melhor/pior automaticamente; tu podes apenas comentar padrões (ex.: "anúncios de carrossel concentram pior CTR").

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

// ── Normalização determinística de métricas (P0) ─────────────────────────────
// Não confiar no status que a IA atribui: recalcular a partir de facts_json
// com thresholds estáveis. Fonte de verdade do semáforo é o servidor.

type DerivedStatus = "bom" | "atenção" | "alerta" | "sem tracking" | "sem dados";

function _num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function _fmtBRL(n: number | null): string {
  if (n == null) return "—";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function _fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function _fmtX(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")}x`;
}

function _fmtNum(n: number | null, dec = 2): string {
  if (n == null) return "—";
  return n.toFixed(dec).replace(".", ",");
}

function _findActionValue(arr: unknown, regex: RegExp): number | null {
  if (!Array.isArray(arr)) return null;
  const hit = arr.find((a) => {
    const o = a as Record<string, unknown>;
    return typeof o?.action_type === "string" && regex.test(o.action_type);
  }) as Record<string, unknown> | undefined;
  return hit ? _num(hit.value) : null;
}

function deriveMetricsFromFacts(
  facts: Record<string, unknown> | null | undefined,
): {
  metrics: { name: string; current: string; reference: string; status: DerivedStatus }[];
  limitations: string[];
} {
  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const spend = _num(ins.spend);
  const impressions = _num(ins.impressions);
  const reach = _num(ins.reach);
  const frequency = _num(ins.frequency);
  const ctr = _num(ins.ctr);
  const cpc = _num(ins.cpc);
  const cpm = _num(ins.cpm);

  const revenue = _findActionValue(ins.action_values, /purchase|omni_purchase/i);
  const purchases = _findActionValue(ins.actions, /^purchase$|^omni_purchase$/i);
  const roas = revenue != null && spend && spend > 0 ? revenue / spend : null;
  const cpa = purchases != null && purchases > 0 && spend ? spend / purchases : null;
  const reachRate = reach != null && impressions && impressions > 0 ? reach / impressions : null;

  const limitations: string[] = [];
  if (roas == null) limitations.push("ROAS não disponível: receita de compra não rastreada nos dados da Meta para este período.");
  if (cpa == null) limitations.push("CPA não disponível: eventos de compra ausentes nos dados da Meta.");

  const sRoas: DerivedStatus = roas == null ? "sem tracking" : roas >= 3 ? "bom" : roas >= 1.5 ? "atenção" : "alerta";
  const sCpa: DerivedStatus = cpa == null ? "sem tracking" : "sem dados"; // CPA depende da margem — não classifica sozinho
  const sCtr: DerivedStatus = ctr == null ? "sem dados" : ctr >= 1.2 ? "bom" : ctr >= 0.8 ? "atenção" : "alerta";
  const sCpm: DerivedStatus = cpm == null ? "sem dados" : cpm <= 25 ? "bom" : cpm <= 40 ? "atenção" : "alerta";
  const sCpc: DerivedStatus = cpc == null ? "sem dados" : cpc <= 2.5 ? "bom" : cpc <= 5 ? "atenção" : "alerta";
  const sFreq: DerivedStatus = frequency == null ? "sem dados" : frequency <= 3.5 ? "bom" : frequency <= 5 ? "atenção" : "alerta";
  const sReach: DerivedStatus = reachRate == null ? "sem dados" : reachRate >= 0.5 ? "bom" : "atenção";

  return {
    metrics: [
      { name: "ROAS", current: roas != null ? _fmtX(roas) : "sem tracking", reference: "> 3x", status: sRoas },
      { name: "CPA", current: cpa != null ? _fmtBRL(cpa) : "sem tracking", reference: "varia por margem", status: sCpa },
      { name: "CTR", current: ctr != null ? _fmtPct(ctr) : "—", reference: "> 1,2%", status: sCtr },
      { name: "CPM", current: cpm != null ? _fmtBRL(cpm) : "—", reference: "< R$ 25", status: sCpm },
      { name: "CPC", current: cpc != null ? _fmtBRL(cpc) : "—", reference: "< R$ 2,50 topo / < R$ 5 fundo", status: sCpc },
      { name: "Frequência", current: _fmtNum(frequency), reference: "< 3,5", status: sFreq },
      { name: "Reach rate", current: reachRate != null ? _fmtPct(reachRate * 100) : "—", reference: "> 50%", status: sReach },
    ],
    limitations,
  };
}

// P1 — Breakdown determinístico por campanha (top por gasto)
type CampaignBreakdownRow = {
  name: string;
  spend: string;
  roas: string;
  ctr: string;
  cpm: string;
  frequency: string;
  status: DerivedStatus;
};

function deriveCampaignBreakdown(
  facts: Record<string, unknown> | null | undefined,
): { rows: CampaignBreakdownRow[]; totalSpend: number } {
  const list = Array.isArray(facts?.campaigns_insights)
    ? (facts!.campaigns_insights as Record<string, unknown>[])
    : [];
  const enriched = list.map((c) => {
    const spend = _num(c.spend) ?? 0;
    const ctr = _num(c.ctr);
    const cpm = _num(c.cpm);
    const frequency = _num(c.frequency);
    const revenue = _findActionValue(c.action_values, /purchase|omni_purchase/i);
    const roas = revenue != null && spend > 0 ? revenue / spend : null;
    const sRoas: DerivedStatus =
      roas == null ? "sem tracking" : roas >= 3 ? "bom" : roas >= 1.5 ? "atenção" : "alerta";
    return {
      name: String(c.campaign_name ?? c.campaign_id ?? "campanha"),
      spendNum: spend,
      spend: _fmtBRL(spend),
      roas: roas != null ? _fmtX(roas) : "sem tracking",
      ctr: _fmtPct(ctr),
      cpm: _fmtBRL(cpm),
      frequency: _fmtNum(frequency),
      status: sRoas,
    };
  });
  enriched.sort((a, b) => b.spendNum - a.spendNum);
  const totalSpend = enriched.reduce((s, r) => s + r.spendNum, 0);
  return {
    rows: enriched.slice(0, 8).map(({ spendNum: _s, ...rest }) => rest),
    totalSpend,
  };
}

// P1 — Melhor / pior anúncio com base em ROAS (fallback CTR), com mínimo de gasto
function deriveBestWorstAds(
  facts: Record<string, unknown> | null | undefined,
): { best: string | null; worst: string | null } {
  const list = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : [];
  if (list.length === 0) return { best: null, worst: null };
  const totalSpend = list.reduce((s, a) => s + (_num(a.spend) ?? 0), 0);
  const minSpend = Math.max(50, totalSpend * 0.02); // 2% do gasto ou R$50
  type Scored = {
    name: string;
    campaign: string;
    spend: number;
    ctr: number | null;
    roas: number | null;
  };
  const scored: Scored[] = list.map((a) => {
    const spend = _num(a.spend) ?? 0;
    const revenue = _findActionValue(a.action_values, /purchase|omni_purchase/i);
    return {
      name: String(a.ad_name ?? a.ad_id ?? "anúncio"),
      campaign: String(a.campaign_name ?? ""),
      spend,
      ctr: _num(a.ctr),
      roas: revenue != null && spend > 0 ? revenue / spend : null,
    };
  });
  const eligible = scored.filter((a) => a.spend >= minSpend);
  const pool = eligible.length >= 2 ? eligible : scored;
  const withRoas = pool.filter((a) => a.roas != null);
  let best: Scored | null = null;
  let worst: Scored | null = null;
  if (withRoas.length >= 2) {
    best = [...withRoas].sort((a, b) => (b.roas! - a.roas!))[0];
    worst = [...withRoas].sort((a, b) => (a.roas! - b.roas!))[0];
  } else {
    const withCtr = pool.filter((a) => a.ctr != null);
    if (withCtr.length >= 2) {
      best = [...withCtr].sort((a, b) => (b.ctr! - a.ctr!))[0];
      worst = [...withCtr].sort((a, b) => (a.ctr! - b.ctr!))[0];
    }
  }
  const fmt = (a: Scored | null) => {
    if (!a) return null;
    const parts: string[] = [a.name];
    if (a.campaign) parts.push(`(${a.campaign})`);
    const metr: string[] = [];
    if (a.roas != null) metr.push(`ROAS ${_fmtX(a.roas)}`);
    if (a.ctr != null) metr.push(`CTR ${_fmtPct(a.ctr)}`);
    metr.push(`gasto ${_fmtBRL(a.spend)}`);
    return `${parts.join(" ")} — ${metr.join(" · ")}`;
  };
  return { best: fmt(best), worst: fmt(worst) };
}

function normalizeAnalysis(
  obj: Record<string, unknown>,
  facts?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!Array.isArray(obj.dataLimitations)) obj.dataLimitations = [];
  if (!Array.isArray(obj.metrics)) obj.metrics = [];
  if (!Array.isArray(obj.budgetLeaks)) obj.budgetLeaks = [];
  if (!Array.isArray(obj.opportunities)) obj.opportunities = [];
  if (!Array.isArray(obj.structureNotes)) obj.structureNotes = [];
  if (!Array.isArray(obj.actionPlan)) obj.actionPlan = [];

  // Fonte de verdade do semáforo: backend determinístico (substitui métricas da IA).
  const derived = deriveMetricsFromFacts(facts ?? null);
  obj.metrics = derived.metrics;
  for (const lim of derived.limitations) {
    if (!(obj.dataLimitations as string[]).includes(lim)) {
      (obj.dataLimitations as string[]).push(lim);
    }
  }

  // P1 — campaign breakdown determinístico
  const cb = deriveCampaignBreakdown(facts ?? null);
  obj.campaignBreakdown = cb.rows;
  if (cb.rows.length === 0) {
    (obj.dataLimitations as string[]).push(
      "Breakdown por campanha indisponível: a Meta não retornou insights ao nível de campanha para o período.",
    );
  }

  // P1 — melhor / pior criativo determinístico (sobrescreve IA se houver dados reais)
  const bw = deriveBestWorstAds(facts ?? null);
  const prevCreatives = (obj.creativesSummary as Record<string, unknown> | undefined) ?? {};
  obj.creativesSummary = {
    best: bw.best ?? (prevCreatives.best as string | null) ?? null,
    worst: bw.worst ?? (prevCreatives.worst as string | null) ?? null,
    recommendation:
      (prevCreatives.recommendation as string | undefined) ??
      "Concentrar verba nos anúncios com melhor ROAS e pausar os de pior performance.",
  };
  if (!bw.best && !bw.worst) {
    (obj.dataLimitations as string[]).push(
      "Análise de criativos limitada: insights ao nível de anúncio não disponíveis ou insuficientes no período.",
    );
  }

  if (typeof obj.scoreLabel !== "string") {
    const s = obj.score as number;
    obj.scoreLabel =
      s >= 90 ? "Excelente" : s >= 70 ? "Bom" : s >= 50 ? "Regular" : s >= 30 ? "Crítico" : "Emergência";
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
    "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values",
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

// P1 — Profundidade analítica: insights por campanha (últimos 30d)
async function fetchCampaignInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "campaign");
  u.searchParams.set(
    "fields",
    "campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,action_values",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("limit", "100");
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = (await r.json()) as {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  if (j.error) throw new Error(j.error.message);
  return j.data ?? [];
}

// P1 — Insights por anúncio (top spenders) com criativo
async function fetchTopAdsInsights(
  actId: string,
  token: string,
  limit = 25,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "ad");
  u.searchParams.set(
    "fields",
    "ad_id,ad_name,campaign_name,impressions,clicks,spend,ctr,cpm,actions,action_values",
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("sort", "spend_descending");
  u.searchParams.set("limit", String(limit));
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
      const normalized = normalizeAnalysis(analysis as Record<string, unknown>, facts);
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
      // P1 — facts enriquecidos com insights por campanha + top anúncios
      const needsEnrichment =
        !factsForAnalysis ||
        !Array.isArray((factsForAnalysis as Record<string, unknown>).campaigns_insights);
      if (needsEnrichment) {
        const account_insights = factsForAnalysis?.account_insights
          ? (factsForAnalysis.account_insights as Record<string, unknown>)
          : await fetchAccountInsights(actId, token);
        const campaigns =
          (factsForAnalysis?.campaigns_sample as Record<string, unknown>[] | undefined) ??
          (await fetchCampaigns(actId, token));
        let campaigns_insights: Record<string, unknown>[] = [];
        let ads_insights_top: Record<string, unknown>[] = [];
        try {
          campaigns_insights = await fetchCampaignInsights(actId, token);
        } catch (e) {
          console.warn(`[process-diagnosis] campaign insights falhou: ${String(e).slice(0, 200)}`);
        }
        try {
          ads_insights_top = await fetchTopAdsInsights(actId, token, 25);
        } catch (e) {
          console.warn(`[process-diagnosis] ad insights falhou: ${String(e).slice(0, 200)}`);
        }
        const facts = {
          meta_ad_account_id: actId,
          date_preset: "last_30d",
          account_insights,
          campaigns_sample: campaigns.slice(0, 40),
          campaigns_insights: campaigns_insights.slice(0, 50),
          ads_insights_top: ads_insights_top.slice(0, 25),
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
